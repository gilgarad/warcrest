import type { Plugin } from "vite";
import { WebSocketServer } from "ws";
import { RELAY_PATH, attachRelay } from "./relayCore";
import { proxyRelayConnection } from "./relayProxy";

/**
 * Mounts the relay on the Vite dev server.
 *
 * One port instead of two: the game and the relay share 5173, so a remote
 * session only needs `ssh -L 5173:localhost:5173` and there is no second port
 * to forget. Vite already runs its own WebSocket for HMR, so the relay takes
 * `noServer: true` and only claims upgrades on RELAY_PATH — anything else is
 * left alone rather than hijacked.
 *
 * `WARCREST_RELAY_UPSTREAM` switches this from hosting the relay to forwarding
 * to one, which is how a deployed relay gets tested from a dev build. It has to
 * be a forward rather than simply pointing the client at the remote address:
 * with a forwarded dev server the browser usually runs on a different machine,
 * so a `localhost` relay port resolves on the browser's side, where nothing is
 * listening. Keeping the socket on the page's own origin sidesteps that
 * entirely — whatever carries 5173 carries the match.
 *
 * Development convenience only; production still runs `npm run relay`.
 */
export function relayPlugin(): Plugin {
  return {
    name: "warcrest-relay",
    configureServer(server) {
      const log = (message: string): void => server.config.logger.info(`[relay] ${message}`);
      const upstream = process.env.WARCREST_RELAY_UPSTREAM?.trim();
      const wss = new WebSocketServer({ noServer: true });
      if (upstream) wss.on("connection", (ws) => proxyRelayConnection(ws, upstream, { log }));
      else {
        const relay = attachRelay(wss, { log });
        // The dev server restarts on config changes; without this each restart
        // would leave its heartbeat interval running.
        server.httpServer?.once("close", () => relay.close());
      }

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
        const target = upstream ? ` → ${upstream}` : "";
        server.config.logger.info(`  ➜  Relay:   ws://localhost:${port}${RELAY_PATH}${target}`);
      });
    },
  };
}
