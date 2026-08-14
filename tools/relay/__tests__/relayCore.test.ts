import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { attachRelay, type RelayHandle } from "../relayCore";

/**
 * Real sockets throughout: what is being tested is connection lifecycle —
 * dropping, holding a seat, coming back — which a mock socket does not have.
 */
const servers: WebSocketServer[] = [];
const handles: RelayHandle[] = [];
const sockets: WebSocket[] = [];

afterEach(() => {
  for (const socket of sockets) socket.close();
  sockets.length = 0;
  for (const handle of handles) handle.close();
  handles.length = 0;
  for (const server of servers) server.close();
  servers.length = 0;
});

interface Harness {
  url: string;
  handle: RelayHandle;
}

async function relay(options: Parameters<typeof attachRelay>[1] = {}): Promise<Harness> {
  const server = await new Promise<WebSocketServer>((resolve) => {
    const created: WebSocketServer = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    servers.push(created);
    created.once("listening", () => resolve(created));
  });
  // Heartbeat off by default: these sockets are idle, and a ping cycle firing
  // mid-test would close them for reasons unrelated to what is being checked.
  const handle = attachRelay(server, { heartbeatMs: 0, ...options });
  handles.push(handle);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { url: `ws://127.0.0.1:${port}`, handle };
}

interface Peer {
  socket: WebSocket;
  inbox: Record<string, unknown>[];
  send: (payload: unknown) => void;
  waitFor: (type: string) => Promise<Record<string, unknown>>;
  has: (type: string) => boolean;
}

async function join(url: string, playerId: string): Promise<Peer> {
  const socket = new WebSocket(url);
  sockets.push(socket);
  const inbox: Record<string, unknown>[] = [];
  socket.on("message", (raw) => inbox.push(JSON.parse(String(raw))));
  await new Promise<void>((resolve) => socket.once("open", () => resolve()));
  const peer: Peer = {
    socket,
    inbox,
    send: (payload) => socket.send(JSON.stringify(payload)),
    has: (type) => inbox.some((message) => message.type === type),
    waitFor: (type) =>
      new Promise((resolve, reject) => {
        const deadline = Date.now() + 4000;
        const poll = (): void => {
          const hit = inbox.find((message) => message.type === type);
          if (hit) return resolve(hit);
          if (Date.now() > deadline) return reject(new Error(`no ${type}; saw ${inbox.map((m) => m.type).join(",")}`));
          setTimeout(poll, 5);
        };
        poll();
      }),
  };
  peer.send({ type: "identify", name: playerId, playerId });
  return peer;
}

const settle = (ms = 120): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function pair(url: string): Promise<{ a: Peer; b: Peer }> {
  const a = await join(url, "alice");
  const b = await join(url, "bob");
  a.send({ type: "find-match" });
  b.send({ type: "find-match" });
  await Promise.all([a.waitFor("matched"), b.waitFor("matched")]);
  return { a, b };
}

describe("relay matchmaking", () => {
  it("does not pair a lone player", async () => {
    const { url, handle } = await relay();
    const a = await join(url, "alice");
    a.send({ type: "find-match" });
    await settle();
    expect(a.has("matched")).toBe(false);
    expect(handle.stats().queued).toBe(1);
  });

  it("takes a disconnected player out of the queue", async () => {
    const { url, handle } = await relay();
    const a = await join(url, "alice");
    a.send({ type: "find-match" });
    await settle();
    a.socket.close();
    await settle();
    // A leftover id here would be matched against the next real player, who
    // would then wait for an opponent that cannot arrive.
    expect(handle.stats().queued).toBe(0);

    const b = await join(url, "bob");
    const c = await join(url, "carol");
    b.send({ type: "find-match" });
    c.send({ type: "find-match" });
    await expect(b.waitFor("matched")).resolves.toBeTruthy();
  });

  it("gives the two sides one seed and opposite teams", async () => {
    const { url } = await relay();
    const { a, b } = await pair(url);
    const first = await a.waitFor("matched");
    const second = await b.waitFor("matched");
    expect(first.seed).toBe(second.seed);
    expect([first.localTeam, second.localTeam].sort()).toEqual(["enemy", "player"]);
  });
});

describe("relay cleanup", () => {
  it("discards the room once both sides are gone", async () => {
    const { url, handle } = await relay();
    const { a, b } = await pair(url);
    a.socket.close();
    b.socket.close();
    await settle();
    expect(handle.stats()).toEqual({ clients: 0, rooms: 0, queued: 0 });
  });

  it("ends the room immediately on an explicit leave", async () => {
    const { url, handle } = await relay();
    const { a, b } = await pair(url);
    a.send({ type: "leave" });
    // A forfeit is final, so the opponent is told it is over rather than being
    // asked to wait for someone who chose to quit.
    await expect(b.waitFor("opponent-left")).resolves.toBeTruthy();
    expect(handle.stats().rooms).toBe(0);
  });

  it("leaves nothing behind after a match ends and both players requeue", async () => {
    const { url, handle } = await relay();
    const { a, b } = await pair(url);
    a.send({ type: "leave" });
    await b.waitFor("opponent-left");
    a.send({ type: "find-match" });
    b.send({ type: "find-match" });
    await settle();
    expect(handle.stats().rooms).toBe(1);
    expect(handle.stats().queued).toBe(0);
  });
});

describe("relay reconnect window", () => {
  it("holds the room and tells the other player to wait", async () => {
    const { url, handle } = await relay({ reconnectGraceMs: 5000 });
    const { a, b } = await pair(url);
    a.socket.close();
    const notice = await b.waitFor("opponent-disconnected");
    expect(notice.graceSec).toBe(5);
    expect(handle.stats().rooms).toBe(1); // still held
  });

  it("seats a returning player back on their original side", async () => {
    const { url } = await relay({ reconnectGraceMs: 5000 });
    const { a, b } = await pair(url);
    const original = await a.waitFor("matched");
    a.socket.close();
    await b.waitFor("opponent-disconnected");

    const back = await join(url, "alice");
    const rejoined = await back.waitFor("rejoined");
    expect(rejoined.localTeam).toBe(original.localTeam);
    expect(rejoined.seed).toBe(original.seed);
    await expect(b.waitFor("opponent-returned")).resolves.toBeTruthy();
  });

  it("replays the frames sent while the player was away", async () => {
    const { url } = await relay({ reconnectGraceMs: 5000 });
    const { a, b } = await pair(url);
    a.send({ type: "frame", frame: { tick: 1 } });
    b.send({ type: "frame", frame: { tick: 2 } });
    await settle();
    a.socket.close();
    await b.waitFor("opponent-disconnected");
    b.send({ type: "frame", frame: { tick: 3 } });
    await settle();

    // Both sides' frames, in order: the returning client has lost its own state
    // too, so replaying only the opponent's would not rebuild the match.
    const back = await join(url, "alice");
    const rejoined = await back.waitFor("rejoined");
    expect(rejoined.frames).toEqual([{ tick: 1 }, { tick: 2 }, { tick: 3 }]);
    expect(rejoined.truncated).toBe(false);
  });

  it("closes the room when nobody comes back in time", async () => {
    const { url, handle } = await relay({ reconnectGraceMs: 60 });
    const { a, b } = await pair(url);
    a.socket.close();
    await expect(b.waitFor("opponent-left")).resolves.toBeTruthy();
    expect(handle.stats().rooms).toBe(0);
  });

  it("does not seat someone else's player id", async () => {
    const { url } = await relay({ reconnectGraceMs: 5000 });
    const { a, b } = await pair(url);
    a.socket.close();
    await b.waitFor("opponent-disconnected");

    const stranger = await join(url, "mallory");
    await settle();
    expect(stranger.has("rejoined")).toBe(false);
  });

  it("marks the log truncated once it passes the cap", async () => {
    const { url } = await relay({ reconnectGraceMs: 5000, maxLoggedFrames: 2 });
    const { a, b } = await pair(url);
    a.send({ type: "frame", frame: { tick: 1 } });
    a.send({ type: "frame", frame: { tick: 2 } });
    a.send({ type: "frame", frame: { tick: 3 } });
    await settle();
    a.socket.close();
    await b.waitFor("opponent-disconnected");

    // Replay is impossible past the cap, and the client is told so rather than
    // resuming from an incomplete history and desyncing.
    const back = await join(url, "alice");
    const rejoined = await back.waitFor("rejoined");
    expect(rejoined.truncated).toBe(true);
    expect((rejoined.frames as unknown[]).length).toBe(2);
  });
});
