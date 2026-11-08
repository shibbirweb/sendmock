import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// The website publishes this app under /demo/, so the base path is configurable.
const basePath = process.env.VITE_BASE_PATH ?? "/";
const isMockBuild = process.env.VITE_API_MODE !== "live";

/**
 * Vite copies `public/` into every build, and MSW keeps its worker there. The live build, which
 * the binary embeds, has no mock layer (UI-12.3), so the worker is removed from its output.
 */
function omitMockServiceWorker(): Plugin {
  return {
    name: "sendmock:omit-mock-service-worker",
    apply: "build",
    writeBundle(outputOptions) {
      if (outputOptions.dir) {
        rmSync(join(outputOptions.dir, "mockServiceWorker.js"), {
          force: true,
        });
      }
    },
  };
}

export default defineConfig({
  base: basePath,
  // `VITE_API_MODE=live bun run dev` talks to a local `cargo run`, with hot reload.
  server: {
    // The mock answers GET /ai/skill with the repository's skill/sendmock/SKILL.md.
    fs: {
      allow: [import.meta.dirname, resolve(import.meta.dirname, "../skill")],
    },
    proxy: isMockBuild
      ? undefined
      : {
          "/api": {
            target: "http://127.0.0.1:8025",
            ws: true,
          },
        },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    ...(isMockBuild ? [] : [omitMockServiceWorker()]),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, "index.html"),
        // Answers the website's API playground with this app's mock API (W10);
        // a live build has no mock layer, so it has no bridge either.
        ...(isMockBuild
          ? {
              playgroundBridge: resolve(
                import.meta.dirname,
                "playground-bridge.html",
              ),
            }
          : {}),
      },
    },
  },
});
