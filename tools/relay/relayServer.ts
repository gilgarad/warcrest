import { WebSocketServer, type WebSocket } from "ws";

/**
 * Matchmaking and message relay for lockstep matches.
 *
 * Deliberately knows nothing about the game. Under lockstep the peers each run
 * the whole simulation, so the server never needs unit positions, resources or
 * rules — it pairs players, agrees a seed, and forwards opaque frames. That is
 * what keeps it small enough to host almost anywhere, and it means gameplay
 * changes never require a server deploy.
 *
 * Run with: npm run relay
 */

type ClientId = string;

interface Client {
  id: ClientId;
  socket: WebSocket;
  name: string;
  roomId: string | null;
}

interface Room {
  id: string;
  seed: string;
  members: ClientId[];
}

const PORT = Number(process.env.RELAY_PORT ?? 8787);

const clients = new Map<ClientId, Client>();
const rooms = new Map<string, Room>();
/** Clients waiting for an automatic match, oldest first. */
const autoQueue: ClientId[] = [];

let nextId = 1;

const server = new WebSocketServer({ port: PORT });
log(`relay listening on ws://localhost:${PORT}`);

server.on("connection", (socket) => {
  const id = `c${nextId++}`;
  const client: Client = { id, socket, name: `player-${id}`, roomId: null };
  clients.set(id, client);
  send(client, { type: "welcome", clientId: id });
  log(`${id} connected (${clients.size} online)`);

  socket.on("message", (raw) => {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      // A malformed message from one client must not take the relay down.
      return;
    }
    handle(client, message);
  });

  socket.on("close", () => {
    dropFromQueue(id);
    leaveRoom(client, "상대가 연결을 끊었습니다");
    clients.delete(id);
    log(`${id} disconnected (${clients.size} online)`);
  });
});

function handle(client: Client, message: Record<string, unknown>): void {
  switch (message.type) {
    case "identify":
      if (typeof message.name === "string" && message.name.trim()) client.name = message.name.trim();
      return;

    case "find-match":
      dropFromQueue(client.id);
      autoQueue.push(client.id);
      tryPair();
      return;

    case "cancel":
      dropFromQueue(client.id);
      return;

    case "frame": {
      // The relay does not read frames; it only forwards them to the opponent.
      const room = client.roomId ? rooms.get(client.roomId) : undefined;
      if (!room) return;
      for (const memberId of room.members) {
        if (memberId === client.id) continue;
        const peer = clients.get(memberId);
        if (peer) send(peer, { type: "frame", frame: message.frame });
      }
      return;
    }

    case "leave":
      leaveRoom(client, "상대가 대전을 떠났습니다");
      return;

    default:
      return;
  }
}

function tryPair(): void {
  while (autoQueue.length >= 2) {
    const first = clients.get(autoQueue.shift() as ClientId);
    const second = clients.get(autoQueue.shift() as ClientId);
    if (!first || !second) continue;

    const room: Room = {
      id: `r${first.id}-${second.id}-${Date.now()}`,
      // The server picks the seed so neither client can choose a favourable one.
      seed: `pvp-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
      members: [first.id, second.id],
    };
    rooms.set(room.id, room);
    first.roomId = room.id;
    second.roomId = room.id;

    // Sides are assigned by the server for the same reason.
    send(first, matched(room, second.name, "player"));
    send(second, matched(room, first.name, "enemy"));
    log(`matched ${first.id} vs ${second.id} in ${room.id}`);
  }
}

function matched(room: Room, opponentName: string, localTeam: "player" | "enemy") {
  return { type: "matched", roomId: room.id, seed: room.seed, opponentName, localTeam };
}

function leaveRoom(client: Client, reason: string): void {
  const room = client.roomId ? rooms.get(client.roomId) : undefined;
  client.roomId = null;
  if (!room) return;
  for (const memberId of room.members) {
    if (memberId === client.id) continue;
    const peer = clients.get(memberId);
    if (!peer) continue;
    peer.roomId = null;
    send(peer, { type: "opponent-left", reason });
  }
  rooms.delete(room.id);
}

function dropFromQueue(id: ClientId): void {
  const index = autoQueue.indexOf(id);
  if (index >= 0) autoQueue.splice(index, 1);
}

function send(client: Client, payload: unknown): void {
  if (client.socket.readyState !== client.socket.OPEN) return;
  client.socket.send(JSON.stringify(payload));
}

function log(message: string): void {
  process.stdout.write(`[relay] ${message}\n`);
}
