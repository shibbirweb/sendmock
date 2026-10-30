import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The website publishes this app under /demo/, so the base path is configurable.
const basePath = process.env.VITE_BASE_PATH ?? "/";
const isMockBuild = process.env.VITE_API_MODE !== "live";

export default defineConfig({
  base: basePath,
  // `VITE_API_MODE=live bun run dev` talks to a local `cargo run`, with hot reload.
  server: isMockBuild
    ? undefined
    : {
        proxy: {
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
