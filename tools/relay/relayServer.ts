import { WebSocketServer } from "ws";
import { attachRelay } from "./relayCore";

/**
 * Standalone relay, for production or for running it apart from the dev server.
 * During development the same core is mounted on Vite instead — see
 * `vitePlugin.ts` — so both paths share one implementation.
 *
 * Run with: npm run relay
 */
const PORT = Number(process.env.RELAY_PORT ?? 8787);
const server = new WebSocketServer({ port: PORT });
attachRelay(server, { log: (message) => process.stdout.write(`[relay] ${message}\n`) });
process.stdout.write(`[relay] listening on ws://localhost:${PORT}\n`);
