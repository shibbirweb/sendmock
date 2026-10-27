#!/usr/bin/env bun
/**
 * Builds one version of the GitHub Pages site: the website at its base path
 * and the mock-mode web app at <base>/demo/ (docs/plan/16-website-and-releases.md).
 * `scripts/build-docs-versions.ts` calls it once per docs version.
 *
 *     PAGES_BASE_PATH=/sendmock bun scripts/build-pages-site.ts
 *
 * Output: website/out (upload it as the Pages artifact).
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type PagesSiteBuild = {
  /** The checkout to build: this repository, or a worktree of a tag. */
  repositoryRoot: string;
  /** The version's full base path, e.g. "/sendmock/next" ("" for a root build). */
  basePath: string;
  /** NEXT_PUBLIC_DOCS_VERSION and NEXT_PUBLIC_DOCS_VERSIONS; left out for a plain build. */
  docsVersionKey?: string;
  docsVersionsJson?: string;
};

function runCommand(
  command: string,
  workingDirectory: string,
  extraEnvironment: Record<string, string>,
) {
  execSync(command, {
    cwd: workingDirectory,
    stdio: "inherit",
    env: { ...process.env, ...extraEnvironment },
  });
}

/** Route paths of the web app, from its file-based routes (e.g. "webhooks/rules"). */
function listWebRoutePaths(
  webDirectory: string,
  routesDirectory: string,
): string[] {
  return readdirSync(routesDirectory).flatMap((entryName) => {
    const entryPath = join(routesDirectory, entryName);
    if (statSync(entryPath).isDirectory()) {
      return listWebRoutePaths(webDirectory, entryPath);
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

/** Builds the website and its demo into <repositoryRoot>/website/out. */
export function buildPagesSite(pagesSiteBuild: PagesSiteBuild): string {
  const webDirectory = join(pagesSiteBuild.repositoryRoot, "web");
  const websiteDirectory = join(pagesSiteBuild.repositoryRoot, "website");
  const versionEnvironment: Record<string, string> = {};
  if (pagesSiteBuild.docsVersionKey !== undefined) {
    versionEnvironment.NEXT_PUBLIC_DOCS_VERSION = pagesSiteBuild.docsVersionKey;
  }
  if (pagesSiteBuild.docsVersionsJson !== undefined) {
    versionEnvironment.NEXT_PUBLIC_DOCS_VERSIONS =
      pagesSiteBuild.docsVersionsJson;
  }

  runCommand("bun run build", webDirectory, {
    VITE_BASE_PATH: `${pagesSiteBuild.basePath}/demo/`,
    VITE_API_MODE: "mock",
    // The demo's guide and Help links open the docs of the same version (WS-03.7).
    VITE_DOCS_URL: `${pagesSiteBuild.basePath}/docs/`,
  });
  runCommand("bun run build", websiteDirectory, {
    NEXT_PUBLIC_BASE_PATH: pagesSiteBuild.basePath,
    ...versionEnvironment,
  });

  const outputDirectory = join(websiteDirectory, "out");
  const demoOutputDirectory = join(outputDirectory, "demo");
  rmSync(demoOutputDirectory, { recursive: true, force: true });
  cpSync(join(webDirectory, "dist"), demoOutputDirectory, { recursive: true });

  // Pages has no SPA fallback: give every app route its own copy of index.html,
  // so deep links like /demo/webhooks/rules load the app instead of a 404.
  for (const routePath of listWebRoutePaths(
    webDirectory,
    join(webDirectory, "src/routes"),
  )) {
    const routeDirectory = join(demoOutputDirectory, routePath);
    mkdirSync(routeDirectory, { recursive: true });
    cpSync(
      join(demoOutputDirectory, "index.html"),
      join(routeDirectory, "index.html"),
    );
  }

  return outputDirectory;
}

if (import.meta.main) {
  const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");
  buildPagesSite({
    repositoryRoot: join(import.meta.dir, ".."),
    basePath: pagesBasePath,
  });
  console.log(
    `\nPages site ready in website/out (base path "${pagesBasePath || "/"}").`,
  );
}
