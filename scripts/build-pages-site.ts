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
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

export type PagesSiteBuild = {
  /** The checkout to build: this repository, or a worktree of a tag. */
  repositoryRoot: string;
  /** The version's full base path, e.g. "/sendmock/next" ("" for a root build). */
  basePath: string;
  /** NEXT_PUBLIC_DOCS_VERSION and NEXT_PUBLIC_DOCS_VERSIONS; left out for a plain build. */
  docsVersionKey?: string;
  docsVersionsJson?: string;
  /**
   * The root version's page list (DOCS_ROOT_PAGE_PATHS_FILE): the build of
   * another version names those pages canonical and keeps the rest out of search.
   */
  rootPagePathsFile?: string;
  /**
   * The current checkout (WEBSITE_GIT_ROOT) when `repositoryRoot` is a tag's
   * worktree: its website code is today's, so the sitemap dates the landing
   * page from this checkout's history.
   */
  websiteGitRoot?: string;
};

const noindexMetaTag = '<meta name="robots" content="noindex" />';

/** The demo is an app with sample data, not a page to find in search. */
export function addNoindexMetaTag(pageHtml: string): string {
  if (pageHtml.includes('name="robots"')) {
    return pageHtml;
  }
  return pageHtml.replace(
    /<head>/i,
    (headTag) => `${headTag}\n    ${noindexMetaTag}`,
  );
}

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

/**
 * The address a TanStack Router route file serves: a dot separates segments as
 * a slash does, a trailing `_` only stops nesting in the parent's layout, a
 * leading `_` (a layout) and `(group)` add no segment, and `index` is the folder.
 * So `mail_.providers.tsx` serves `mail/providers`.
 */
export function toAppRoutePath(routeFilePath: string): string {
  return routeFilePath
    .replace(/\.tsx$/, "")
    .split(/[/.]/)
    .filter(
      (routeSegment) =>
        !routeSegment.startsWith("_") && !/^\(.*\)$/.test(routeSegment),
    )
    .map((routeSegment) => routeSegment.replace(/_$/, ""))
    .filter(
      (routeSegment, segmentIndex, routeSegments) =>
        !(
          routeSegment === "index" && segmentIndex === routeSegments.length - 1
        ),
    )
    .join("/");
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

    const routePath = toAppRoutePath(
      relative(join(webDirectory, "src/routes"), entryPath),
    );

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
  if (pagesSiteBuild.rootPagePathsFile !== undefined) {
    versionEnvironment.DOCS_ROOT_PAGE_PATHS_FILE =
      pagesSiteBuild.rootPagePathsFile;
  }
  if (pagesSiteBuild.websiteGitRoot !== undefined) {
    versionEnvironment.WEBSITE_GIT_ROOT = pagesSiteBuild.websiteGitRoot;
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
  const demoIndexPath = join(demoOutputDirectory, "index.html");
  writeFileSync(
    demoIndexPath,
    addNoindexMetaTag(readFileSync(demoIndexPath, "utf8")),
  );

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
