import { defineConfig } from "vite";
import { relayPlugin } from "./tools/relay/vitePlugin";

export default defineConfig({
  base: "/warcrest/",
  // The PvP relay rides along on the dev server so local play needs one port,
  // not two. Production runs it standalone via `npm run relay`.
  plugins: [relayPlugin()],
});
