import type { WebSocket, WebSocketServer } from "ws";

/**
 * Matchmaking and message relay, independent of how the socket server was
 * created.
 *
 * Split out so the same logic serves both hosting shapes: mounted on the Vite
 * dev server during development (one port, one thing to forward over SSH) and
 * run standalone in production. Duplicating it would guarantee the two drift.
 *
 * The relay knows nothing about the game. Under lockstep the peers each run the
 * whole simulation, so the server never needs unit positions, resources or
 * rules — it pairs players, agrees a seed, and forwards opaque frames. That is
 * what keeps it small enough to host almost anywhere, and it means gameplay
 * changes never require a server deploy.
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

export interface RelayHooks {
  log?: (message: string) => void;
  /** Injectable so tests can make seeds predictable. */
  now?: () => number;
  random?: () => number;
}

export function attachRelay(server: WebSocketServer, hooks: RelayHooks = {}): void {
  const log = hooks.log ?? (() => {});
  const now = hooks.now ?? (() => Date.now());
  const random = hooks.random ?? Math.random;

  const clients = new Map<ClientId, Client>();
  const rooms = new Map<string, Room>();
  /** Waiting for an automatic match, oldest first. */
  const autoQueue: ClientId[] = [];
  let nextId = 1;

  server.on("connection", (socket: WebSocket) => {
    const id = `c${nextId++}`;
    const client: Client = { id, socket, name: `player-${id}`, roomId: null };
    clients.set(id, client);
    send(client, { type: "welcome", clientId: id });
    log(`${id} connected (${clients.size} online)`);

    socket.on("message", (raw: unknown) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        // One malformed message must not take the relay down for everyone.
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
        id: `r${first.id}-${second.id}-${now()}`,
        // The server picks the seed and the sides; a client that chose its own
        // could shop for a favourable start.
        seed: `pvp-${now()}-${Math.floor(random() * 1e9)}`,
        members: [first.id, second.id],
      };
      rooms.set(room.id, room);
      first.roomId = room.id;
      second.roomId = room.id;
      send(first, { type: "matched", roomId: room.id, seed: room.seed, opponentName: second.name, localTeam: "player" });
      send(second, { type: "matched", roomId: room.id, seed: room.seed, opponentName: first.name, localTeam: "enemy" });
      log(`matched ${first.id} vs ${second.id}`);
    }
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
    if (client.socket.readyState !== 1) return; // 1 === OPEN
    client.socket.send(JSON.stringify(payload));
  }
}

/** Path the relay listens on when mounted alongside the dev server. */
export const RELAY_PATH = "/relay";
