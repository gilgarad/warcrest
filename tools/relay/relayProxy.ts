import { WebSocket } from "ws";

/**
 * Forwards one dev-server relay connection to a relay running elsewhere.
 *
 * This exists so the browser only ever needs the page's own origin. When the
 * real relay runs on another host, pointing the client straight at it means
 * that host's port has to be reachable from wherever the browser is — and with
 * a forwarded dev server the browser is usually not on the same machine as the
 * dev server, so `localhost:<relay port>` resolves on the wrong side and the
 * socket simply fails. Proxying keeps the whole match on the one port that is
 * already forwarded.
 *
 * Development only. Production serves the relay through nginx.
 */
export interface RelayProxyOptions {
  log?: (message: string) => void;
}

export function proxyRelayConnection(
  client: WebSocket,
  upstreamUrl: string,
  options: RelayProxyOptions = {},
): WebSocket {
  const log = options.log ?? (() => {});
  const upstream = new WebSocket(upstreamUrl);

  // The client sends `identify` the instant its socket opens, which is before
  // the upstream socket has finished connecting. Dropping those first messages
  // would leave the player sitting in the lobby having never joined a queue, so
  // they are held until upstream is ready.
  const pending: string[] = [];

  client.on("message", (raw) => {
    const text = String(raw);
    if (upstream.readyState === WebSocket.OPEN) upstream.send(text);
    else pending.push(text);
  });

  upstream.on("open", () => {
    for (const text of pending) upstream.send(text);
    pending.length = 0;
    log(`proxying to ${upstreamUrl}`);
  });

  upstream.on("message", (raw) => {
    if (client.readyState === WebSocket.OPEN) client.send(String(raw));
  });

  // Either side going away must take the pair down. A half-open proxy would
  // look like an opponent who has stopped sending frames — indistinguishable
  // from a hang, and the match would never recover.
  const closeBoth = (): void => {
    if (client.readyState === WebSocket.OPEN) client.close();
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      upstream.close();
    }
  };

  client.on("close", closeBoth);
  upstream.on("close", closeBoth);
  upstream.on("error", (error: Error) => {
    log(`upstream error: ${error.message}`);
    closeBoth();
  });
  client.on("error", closeBoth);

  return upstream;
}
