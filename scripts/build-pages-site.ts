#!/usr/bin/env bun
/**
 * Builds the GitHub Pages site: the website at the root and the mock-mode web
 * app at /demo/ (docs/plan/16-website-and-releases.md).
 *
 *     PAGES_BASE_PATH=/messagehook bun scripts/build-pages-site.ts
 *
 * Output: website/out (upload it as the Pages artifact).
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repositoryRoot = join(import.meta.dir, "..");
const webDirectory = join(repositoryRoot, "web");
const websiteDirectory = join(repositoryRoot, "website");
const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");

function runCommand(command: string, workingDirectory: string, extraEnvironment: Record<string, string>) {
  execSync(command, {
    cwd: workingDirectory,
    stdio: "inherit",
    env: { ...process.env, ...extraEnvironment },
  });
}

/** Route paths of the web app, from its file-based routes (e.g. "webhooks/rules"). */
function listWebRoutePaths(routesDirectory: string): string[] {
  return readdirSync(routesDirectory).flatMap((entryName) => {
    const entryPath = join(routesDirectory, entryName);
    if (statSync(entryPath).isDirectory()) {
      return listWebRoutePaths(entryPath);
    }

    if (!entryName.endsWith(".tsx") || entryName.startsWith("__")) {
      return [];
    }

    const routePath = relative(join(webDirectory, "src/routes"), entryPath)
      .replace(/\.tsx$/, "")
      .replace(/(^|\/)index$/, "");

    return routePath === "" ? [] : [routePath];
  });
}

runCommand("bun run build", webDirectory, {
  VITE_BASE_PATH: `${pagesBasePath}/demo/`,
  VITE_API_MODE: "mock",
});
runCommand("bun run build", websiteDirectory, {
  NEXT_PUBLIC_BASE_PATH: pagesBasePath,
});

const demoOutputDirectory = join(websiteDirectory, "out", "demo");
rmSync(demoOutputDirectory, { recursive: true, force: true });
cpSync(join(webDirectory, "dist"), demoOutputDirectory, { recursive: true });

// Pages has no SPA fallback: give every app route its own copy of index.html,
// so deep links like /demo/webhooks/rules load the app instead of a 404.
for (const routePath of listWebRoutePaths(join(webDirectory, "src/routes"))) {
  const routeDirectory = join(demoOutputDirectory, routePath);
  mkdirSync(routeDirectory, { recursive: true });
  cpSync(join(demoOutputDirectory, "index.html"), join(routeDirectory, "index.html"));
}

console.log(`\nPages site ready in website/out (base path "${pagesBasePath || "/"}").`);
