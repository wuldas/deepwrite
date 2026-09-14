import { resolve } from "node:path";
import { build } from "vite";

// Builds the browser bridge entry (`window.deepwrite` over HTTP + SSE) as a
// standalone ES module next to the renderer bundle, without touching the
// renderer chunk graph that tools/check-renderer-build.mjs budgets.
// It resolves the full contracts barrel, mirroring the preload build.
const workspaceRoot = resolve(import.meta.dirname, "..");
const appRoot = resolve(workspaceRoot, "apps/desktop");

await build({
  root: appRoot,
  configFile: false,
  logLevel: "warn",
  resolve: {
    alias: {
      "@deepwrite/contracts": resolve(
        workspaceRoot,
        "packages/contracts/src/index.ts"
      ),
      "@deepwrite/contracts/system": resolve(
        workspaceRoot,
        "packages/contracts/src/system.ts"
      ),
      "@deepwrite/pi-runtime-adapter": resolve(
        workspaceRoot,
        "packages/pi-runtime-adapter/src/index.ts"
      ),
      "@deepwrite/shared": resolve(
        workspaceRoot,
        "packages/shared/src/index.ts"
      )
    }
  },
  build: {
    outDir: resolve(appRoot, "out/renderer"),
    emptyOutDir: false,
    minify: true,
    rollupOptions: {
      input: resolve(appRoot, "src/preload/web-entry.ts"),
      output: {
        format: "es",
        entryFileNames: "deepwrite-web.js",
        chunkFileNames: "assets/web-bridge-[hash].js"
      }
    }
  }
});
