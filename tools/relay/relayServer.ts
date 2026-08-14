import { WebSocketServer } from "ws";
// Explicit .ts extension: Node's ESM resolver does not guess extensions, and
// this file is run directly by `npm run relay` (the production path) rather
// than through Vite, which does.
import { attachRelay } from "./relayCore.ts";

/**
 * Standalone relay, for production or for running it apart from the dev server.
 * During development the same core is mounted on Vite instead — see
 * `vitePlugin.ts` — so both paths share one implementation.
 *
 * Run with: npm run relay
 */
const PORT = Number(process.env.RELAY_PORT ?? 8787);
/**
 * Bound to loopback by default.
 *
 * In production nginx terminates TLS and proxies to this process, so it is the
 * only client and the port never needs to be reachable from outside the host.
 * Binding to 0.0.0.0 would expose a plaintext `ws://` endpoint alongside the
 * `wss://` one — same relay, no encryption, and no new port opened knowingly.
 * Override with RELAY_HOST only if something else genuinely needs to reach it.
 */
const HOST = process.env.RELAY_HOST ?? "127.0.0.1";
const server = new WebSocketServer({ host: HOST, port: PORT });
const relay = attachRelay(server, { log: (message) => process.stdout.write(`[relay] ${message}\n`) });
process.stdout.write(`[relay] listening on ws://${HOST}:${PORT}\n`);

// systemd sends SIGTERM on restart. Closing explicitly stops the heartbeat
// timer and drops the retained frame logs, rather than leaving that to however
// abruptly the process happens to die.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    relay.close();
    server.close(() => process.exit(0));
  });
}
