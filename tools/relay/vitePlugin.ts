import type { Plugin } from "vite";
import { WebSocketServer } from "ws";
import { RELAY_PATH, attachRelay } from "./relayCore";

/**
 * Mounts the relay on the Vite dev server.
 *
 * One port instead of two: the game and the relay share 5173, so a remote
 * session only needs `ssh -L 5173:localhost:5173` and there is no second port
 * to forget. Vite already runs its own WebSocket for HMR, so the relay takes
 * `noServer: true` and only claims upgrades on RELAY_PATH — anything else is
 * left alone rather than hijacked.
 *
 * Development convenience only; production still runs `npm run relay`.
 */
export function relayPlugin(): Plugin {
  return {
    name: "warcrest-relay",
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      attachRelay(wss, { log: (message) => server.config.logger.info(`[relay] ${message}`) });

      server.httpServer?.on("upgrade", (request, socket, head) => {
        const url = request.url ?? "";
        if (!url.startsWith(RELAY_PATH)) return;
        wss.handleUpgrade(request, socket as never, head, (ws) => wss.emit("connection", ws, request));
      });

      // Report the port actually bound, not the configured one: Vite falls
      // back to the next free port when 5173 is taken, and printing the
      // configured value would send people at a port nothing is listening on.
      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        const port = typeof address === "object" && address ? address.port : server.config.server.port;
        server.config.logger.info(`  ➜  Relay:   ws://localhost:${port}${RELAY_PATH}`);
      });
    },
  };
}
