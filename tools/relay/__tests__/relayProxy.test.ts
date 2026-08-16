import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { proxyRelayConnection } from "../relayProxy";

/**
 * These use real sockets rather than mocks. The bug this module exists to
 * prevent is about connection timing, which a mock would simply not have.
 */
const servers: WebSocketServer[] = [];
const sockets: WebSocket[] = [];

afterEach(() => {
  for (const socket of sockets) socket.close();
  sockets.length = 0;
  for (const server of servers) server.close();
  servers.length = 0;
});

const listen = (): Promise<WebSocketServer> =>
  new Promise<WebSocketServer>((resolve) => {
    const server: WebSocketServer = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    servers.push(server);
    server.once("listening", () => resolve(server));
  });

const addressOf = (server: WebSocketServer): string => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return `ws://127.0.0.1:${port}`;
};

const connect = (url: string): WebSocket => {
  const socket = new WebSocket(url);
  sockets.push(socket);
  return socket;
};

const nextMessage = (socket: WebSocket): Promise<string> =>
  new Promise((resolve, reject) => {
    socket.once("message", (raw) => resolve(String(raw)));
    setTimeout(() => reject(new Error("timed out waiting for a message")), 4000);
  });

const nextConnection = (server: WebSocketServer): Promise<WebSocket> =>
  new Promise((resolve) => server.once("connection", (socket) => resolve(socket)));

/**
 * Collects messages from the moment it is called.
 *
 * Awaiting `nextMessage` repeatedly cannot be used to check ordering: messages
 * that arrive while no listener is attached are gone, so a burst would look
 * like a single message. Recording continuously is the only way to observe the
 * order the proxy actually produced.
 */
function record(socket: WebSocket): { waitFor: (count: number) => Promise<string[]> } {
  const seen: string[] = [];
  socket.on("message", (raw) => seen.push(String(raw)));
  return {
    waitFor: (count) =>
      new Promise((resolve, reject) => {
        const deadline = Date.now() + 4000;
        const poll = (): void => {
          if (seen.length >= count) return resolve(seen.slice(0, count));
          if (Date.now() > deadline) return reject(new Error(`only saw ${seen.length} of ${count}`));
          setTimeout(poll, 10);
        };
        poll();
      }),
  };
}

const closed = (socket: WebSocket): Promise<void> =>
  new Promise((resolve) => socket.once("close", () => resolve()));

/** A dev server stand-in: every connection it accepts gets proxied upstream. */
async function proxyingServer(upstreamUrl: string): Promise<WebSocketServer> {
  const server = await listen();
  server.on("connection", (socket) => proxyRelayConnection(socket, upstreamUrl));
  return server;
}

describe("proxyRelayConnection", () => {
  it("holds messages sent before upstream is connected", async () => {
    const upstream = await listen();
    const front = await proxyingServer(addressOf(upstream));

    const client = connect(addressOf(front));
    // Sent the moment the client's own socket opens — upstream is still
    // connecting at this point, which is exactly the case that used to drop it.
    client.on("open", () => client.send(JSON.stringify({ type: "identify", name: "A" })));

    const upstreamSocket = await nextConnection(upstream);
    expect(JSON.parse(await nextMessage(upstreamSocket))).toEqual({ type: "identify", name: "A" });
  });

  it("preserves the order of messages held across the connect", async () => {
    const upstream = await listen();
    const front = await proxyingServer(addressOf(upstream));

    const client = connect(addressOf(front));
    client.on("open", () => {
      client.send("first");
      client.send("second");
      client.send("third");
    });

    const upstreamSocket = await nextConnection(upstream);
    expect(await record(upstreamSocket).waitFor(3)).toEqual(["first", "second", "third"]);
  });

  it("returns upstream messages to the client", async () => {
    const upstream = await listen();
    upstream.on("connection", (socket) => socket.send(JSON.stringify({ type: "welcome" })));
    const front = await proxyingServer(addressOf(upstream));

    const client = connect(addressOf(front));
    expect(JSON.parse(await nextMessage(client))).toEqual({ type: "welcome" });
  });

  it("closes the client when upstream goes away", async () => {
    const upstream = await listen();
    const front = await proxyingServer(addressOf(upstream));

    const client = connect(addressOf(front));
    const upstreamSocket = await nextConnection(upstream);
    upstreamSocket.close();

    // Without this the client would hang looking like an unresponsive opponent.
    await expect(closed(client)).resolves.toBeUndefined();
  });

  it("closes the client when upstream cannot be reached at all", async () => {
    // Nothing is listening here: a relay that is down must surface as a failed
    // connection so the lobby can say so, not as a silent wait.
    const front = await proxyingServer("ws://127.0.0.1:1");
    const client = connect(addressOf(front));
    await expect(closed(client)).resolves.toBeUndefined();
  });
});
