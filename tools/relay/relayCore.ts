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
 *
 * The one thing it does keep is the frame log per room, because that is what a
 * disconnected player needs to rebuild their game: the same seed plus the same
 * commands in the same order reproduces the match exactly. See
 * `docs/dev-wiki/pvp-reconnect.md`.
 */

type ClientId = string;
type Team = "player" | "enemy";

interface Client {
  id: ClientId;
  socket: WebSocket;
  name: string;
  /**
   * Stable across reconnects, unlike `id`. Accounts do not exist yet, so the
   * client supplies this and the relay trusts it — deliberately provisional,
   * see the doc above for what a real identity has to add.
   */
  playerId: string;
  roomId: string | null;
  /** Heartbeat liveness; see `reapDeadConnections`. */
  responsive: boolean;
}

interface Seat {
  playerId: string;
  team: Team;
  /** Null while the seat's occupant is disconnected but still expected back. */
  clientId: ClientId | null;
  name: string;
}

interface LoggedFrame {
  team: Team;
  frame: unknown;
}

interface Room {
  id: string;
  seed: string;
  seats: Seat[];
  /** Every frame both sides have sent, in arrival order, for reconnect replay. */
  frames: LoggedFrame[];
  /** Set while a seat is vacant and the room is being held open. */
  graceTimer: ReturnType<typeof setTimeout> | null;
}

export interface RelayHooks {
  log?: (message: string) => void;
  /** Injectable so tests can make seeds predictable. */
  now?: () => number;
  random?: () => number;
  /** How long a room is held open for a disconnected player to come back. */
  reconnectGraceMs?: number;
  /** Heartbeat interval; 0 disables it (tests, which have no idle sockets). */
  heartbeatMs?: number;
  /**
   * Cap on retained frames per room. A match that runs for hours must not grow
   * without bound; passing the cap makes the room unreplayable rather than
   * letting the relay's memory become the limit.
   */
  maxLoggedFrames?: number;
}

export const DEFAULT_RECONNECT_GRACE_MS = 60_000;
export const DEFAULT_HEARTBEAT_MS = 30_000;
export const DEFAULT_MAX_LOGGED_FRAMES = 200_000;

export interface RelayHandle {
  /** Stops timers. Without this a long-lived host leaks intervals per attach. */
  close(): void;
  /** Test/diagnostic view: nothing in the relay's behaviour depends on it. */
  stats(): { clients: number; rooms: number; queued: number };
}

export function attachRelay(server: WebSocketServer, hooks: RelayHooks = {}): RelayHandle {
  const log = hooks.log ?? (() => {});
  const now = hooks.now ?? (() => Date.now());
  const random = hooks.random ?? Math.random;
  const graceMs = hooks.reconnectGraceMs ?? DEFAULT_RECONNECT_GRACE_MS;
  const heartbeatMs = hooks.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const maxLoggedFrames = hooks.maxLoggedFrames ?? DEFAULT_MAX_LOGGED_FRAMES;

  const clients = new Map<ClientId, Client>();
  const rooms = new Map<string, Room>();
  /** Waiting for an automatic match, oldest first. */
  const autoQueue: ClientId[] = [];
  let nextId = 1;

  server.on("connection", (socket: WebSocket) => {
    const id = `c${nextId++}`;
    const client: Client = {
      id,
      socket,
      name: `player-${id}`,
      playerId: id, // Replaced by `identify`; a per-connection default means an
      roomId: null, // unidentified client simply never matches an old seat.
      responsive: true,
    };
    clients.set(id, client);
    send(client, { type: "welcome", clientId: id });
    log(`${id} connected (${clients.size} online)`);

    socket.on("pong", () => { client.responsive = true; });

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
      vacateSeat(client);
      clients.delete(id);
      log(`${id} disconnected (${clients.size} online)`);
    });

    socket.on("error", () => socket.close());
  });

  function handle(client: Client, message: Record<string, unknown>): void {
    switch (message.type) {
      case "identify": {
        if (typeof message.name === "string" && message.name.trim()) client.name = message.name.trim();
        if (typeof message.playerId === "string" && message.playerId.trim()) {
          client.playerId = message.playerId.trim();
          resumeIfSeatHeld(client);
        }
        return;
      }
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
        const seat = room.seats.find((entry) => entry.clientId === client.id);
        if (!seat) return;
        if (room.frames.length < maxLoggedFrames) room.frames.push({ team: seat.team, frame: message.frame });
        for (const other of room.seats) {
          if (other.clientId === null || other.clientId === client.id) continue;
          const peer = clients.get(other.clientId);
          if (peer) send(peer, { type: "frame", frame: message.frame });
        }
        return;
      }
      case "leave":
        // An explicit leave is a forfeit, not a dropout: nobody is coming back,
        // so the room goes away now rather than holding the other player in a
        // pointless wait.
        closeRoom(client.roomId, "상대가 대전을 떠났습니다", client.id);
        return;
      default:
        return;
    }
  }

  function tryPair(): void {
    while (autoQueue.length >= 2) {
      const firstId = autoQueue.shift() as ClientId;
      const first = clients.get(firstId);
      if (!first) continue; // Gone; the next candidate takes its place.
      const secondIndex = autoQueue.findIndex((id) => clients.has(id));
      if (secondIndex === -1) {
        // Nobody left to pair with, so the first player goes back at the front.
        // Defensive rather than a fix for anything observed: disconnects already
        // dequeue, so a stale id should not reach here. It is written this way
        // because the alternative failure — shifting a live player off the queue
        // and discarding them — is invisible from the outside and leaves someone
        // waiting forever.
        autoQueue.unshift(firstId);
        return;
      }
      const second = clients.get(autoQueue.splice(secondIndex, 1)[0] as ClientId) as Client;
      const room: Room = {
        id: `r${first.id}-${second.id}-${now()}`,
        // The server picks the seed and the sides; a client that chose its own
        // could shop for a favourable start.
        seed: `pvp-${now()}-${Math.floor(random() * 1e9)}`,
        seats: [
          { playerId: first.playerId, team: "player", clientId: first.id, name: first.name },
          { playerId: second.playerId, team: "enemy", clientId: second.id, name: second.name },
        ],
        frames: [],
        graceTimer: null,
      };
      rooms.set(room.id, room);
      first.roomId = room.id;
      second.roomId = room.id;
      send(first, { type: "matched", roomId: room.id, seed: room.seed, opponentName: second.name, localTeam: "player" });
      send(second, { type: "matched", roomId: room.id, seed: room.seed, opponentName: first.name, localTeam: "enemy" });
      log(`matched ${first.id} vs ${second.id}`);
    }
  }

  /**
   * Holds the room open when someone drops instead of tearing it down.
   *
   * The remaining player is told to wait rather than being dumped back to the
   * lobby, because a dropped connection is usually transient and the match is
   * still perfectly recoverable — the frame log plus the seed is the whole game.
   */
  function vacateSeat(client: Client): void {
    const room = client.roomId ? rooms.get(client.roomId) : undefined;
    client.roomId = null;
    if (!room) return;
    const seat = room.seats.find((entry) => entry.clientId === client.id);
    if (seat) seat.clientId = null;

    const remaining = room.seats.filter((entry) => entry.clientId !== null);
    if (remaining.length === 0) {
      // Nobody is watching, so nobody can be told anything. Holding the room
      // would just be a leak.
      discardRoom(room, "both sides gone");
      return;
    }
    for (const entry of remaining) {
      const peer = entry.clientId ? clients.get(entry.clientId) : undefined;
      if (peer) {
        send(peer, {
          type: "opponent-disconnected",
          reason: "상대의 연결이 끊겼습니다 — 재접속을 기다립니다",
          graceSec: Math.round(graceMs / 1000),
        });
      }
    }
    if (room.graceTimer) clearTimeout(room.graceTimer);
    room.graceTimer = setTimeout(() => {
      room.graceTimer = null;
      closeRoom(room.id, "상대가 돌아오지 않았습니다", null);
    }, graceMs);
    log(`${client.id} left room ${room.id}; holding ${Math.round(graceMs / 1000)}s`);
  }

  /**
   * Puts a returning player back in the seat they left, and hands them the
   * frame log so they can rebuild the match from the seed.
   */
  function resumeIfSeatHeld(client: Client): void {
    if (client.roomId) return;
    for (const room of rooms.values()) {
      const seat = room.seats.find((entry) => entry.playerId === client.playerId && entry.clientId === null);
      if (!seat) continue;
      seat.clientId = client.id;
      seat.name = client.name;
      client.roomId = room.id;
      dropFromQueue(client.id);
      if (room.graceTimer) {
        clearTimeout(room.graceTimer);
        room.graceTimer = null;
      }
      const opponent = room.seats.find((entry) => entry.playerId !== client.playerId);
      send(client, {
        type: "rejoined",
        roomId: room.id,
        seed: room.seed,
        localTeam: seat.team,
        opponentName: opponent?.name ?? "상대",
        frames: room.frames.map((entry) => entry.frame),
        truncated: room.frames.length >= maxLoggedFrames,
      });
      const peerId = opponent?.clientId;
      const peer = peerId ? clients.get(peerId) : undefined;
      if (peer) send(peer, { type: "opponent-returned", opponentName: client.name });
      log(`${client.id} rejoined room ${room.id} as ${seat.team}`);
      return;
    }
  }

  /** Ends a room for good and tells whoever is still connected. */
  function closeRoom(roomId: string | null, reason: string, exceptClientId: ClientId | null): void {
    const room = roomId ? rooms.get(roomId) : undefined;
    if (!room) return;
    for (const seat of room.seats) {
      const peer = seat.clientId ? clients.get(seat.clientId) : undefined;
      if (seat.clientId) {
        const occupant = clients.get(seat.clientId);
        if (occupant) occupant.roomId = null;
      }
      if (!peer || peer.id === exceptClientId) continue;
      send(peer, { type: "opponent-left", reason });
    }
    if (exceptClientId) {
      const leaver = clients.get(exceptClientId);
      if (leaver) leaver.roomId = null;
    }
    discardRoom(room, reason);
  }

  function discardRoom(room: Room, reason: string): void {
    if (room.graceTimer) clearTimeout(room.graceTimer);
    room.graceTimer = null;
    // Dropping the frame log matters: it is by far the largest thing the relay
    // holds, and a room that is never discarded is a room whose log grows for
    // as long as the process lives.
    room.frames.length = 0;
    rooms.delete(room.id);
    log(`room ${room.id} closed (${reason})`);
  }

  function dropFromQueue(id: ClientId): void {
    const index = autoQueue.indexOf(id);
    if (index >= 0) autoQueue.splice(index, 1);
  }

  function send(client: Client, payload: unknown): void {
    if (client.socket.readyState !== 1) return; // 1 === OPEN
    client.socket.send(JSON.stringify(payload));
  }

  /**
   * Closes sockets that stopped answering.
   *
   * A connection dropped without a TCP close (sleeping laptop, vanished
   * network) stays "open" indefinitely, so without this those clients pile up
   * in the queue and get matched against real players who then wait for an
   * opponent that will never send a frame.
   */
  function reapDeadConnections(): void {
    for (const client of [...clients.values()]) {
      if (!client.responsive) {
        log(`${client.id} failed heartbeat; closing`);
        client.socket.terminate();
        continue;
      }
      client.responsive = false;
      client.socket.ping();
    }
  }

  const heartbeat = heartbeatMs > 0 ? setInterval(reapDeadConnections, heartbeatMs) : null;

  return {
    close(): void {
      if (heartbeat) clearInterval(heartbeat);
      for (const room of [...rooms.values()]) discardRoom(room, "relay closing");
    },
    stats: () => ({ clients: clients.size, rooms: rooms.size, queued: autoQueue.length }),
  };
}

/** Path the relay listens on when mounted alongside the dev server. */
export const RELAY_PATH = "/relay";
