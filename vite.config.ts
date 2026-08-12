import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(__dirname, "dist/client");

/**
 * F-8: stamp the service worker cache name per build so `activate` can drop the
 * previous release's assets. `public/sw.js` ships the literal `__SW_BUILD__`
 * placeholder; Vite copies public/ verbatim, so we rewrite the emitted file.
 */
function swCacheVersion(): Plugin {
  return {
    name: "sw-cache-version",
    apply: "build",
    closeBundle() {
      const file = path.join(outDir, "sw.js");
      if (!fs.existsSync(file)) return;
      const stamp =
        process.env.SW_BUILD_ID ||
        `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now()
          .toString(36)
          .slice(-5)}`;
      const src = fs.readFileSync(file, "utf8");
      fs.writeFileSync(file, src.replace(/__SW_BUILD__/g, stamp));
      this.info?.(`sw cache → music-shell-${stamp}`);
    },
  };
}

export default defineConfig({
  root: "client",
  plugins: [react(), swCacheVersion()],
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    middlewareMode: true,
  },
});
