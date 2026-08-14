/**
 * Where the client looks for the PvP relay.
 *
 * These do not live on the same host in production. The game is served as a
 * static site from GitHub Pages while the relay is a long-running process on
 * the 104 server, so deriving the address from `window.location` — which is
 * right for local development, where the dev server carries both — would send
 * the deployed build at `gilgarad.github.io/relay`, which does not exist.
 *
 * `VITE_RELAY_URL` is therefore baked in at build time for deployed builds, and
 * same-origin remains the fallback so `npm run dev` needs no configuration.
 */
export function resolveRelayUrl(): string {
  const configured = import.meta.env.VITE_RELAY_URL as string | undefined;
  if (configured && configured.trim()) return configured.trim();

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/relay`;
}

/**
 * A page served over HTTPS may not open a plaintext `ws://` socket — browsers
 * block it as mixed content, and the failure surfaces as a bare connection
 * error with no hint about the cause. Worth detecting so the lobby can say
 * something useful instead.
 */
export function isMixedContentRelay(url: string): boolean {
  return window.location.protocol === "https:" && url.startsWith("ws://");
}
