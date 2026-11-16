#!/usr/bin/env bun
/**
 * Builds every docs version of the Pages site (docs/plan/16-website-and-releases.md,
 * "Versioned builds"): `/` the newest stable minor, `/next/` develop, `/vX.Y/`
 * older minors, each with its own demo. Before the first stable tag, `/` is a
 * Preview built from develop.
 *
 *     PAGES_BASE_PATH=/sendmock bun scripts/build-docs-versions.ts
 *
 * A tag is built in a temporary git worktree with the current website code
 * copied over it (scripts/docs-version-worktree.ts), so the working tree is
 * never changed (WS-03.5).
 * The root version is built first: the others read its page list, so each of
 * their pages names the root's page as canonical, or is kept out of search
 * when the root has no such page. Only the root keeps a sitemap.
 *
 * Output: website/out (upload it as the Pages artifact).
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type DocsVersion,
  resolveDocsVersions,
} from "../website/lib/docs-versions";
import { buildPagesSite } from "./build-pages-site";
import { listBuiltPagePaths } from "./docs-version-pages";
import { prepareTagWorktree, removeTagWorktree } from "./docs-version-worktree";

const repositoryRoot = join(import.meta.dir, "..");
const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");

function runGit(gitArguments: string[]) {
  return execFileSync("git", gitArguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function listGitTags(): string[] {
  return runGit(["tag", "--list"])
    .split("\n")
    .filter((tagName) => tagName.trim() !== "");
}

/** The switcher's list, with each version's address under the Pages base path. */
function serialiseDocsVersions(docsVersions: DocsVersion[]): string {
  return JSON.stringify(
    docsVersions.map((docsVersion) => ({
      key: docsVersion.key,
      label: docsVersion.label,
      kind: docsVersion.kind,
      href: `${pagesBasePath}${docsVersion.path}/`,
    })),
  );
}

type DocsVersionBuild = {
  docsVersionsJson: string;
  worktreesDirectory: string;
  stagingDirectory: string;
  /** Left out for the root version, which is built first. */
  rootPagePathsFile?: string;
};

function buildDocsVersion(
  docsVersion: DocsVersion,
  docsVersionBuild: DocsVersionBuild,
) {
  const {
    docsVersionsJson,
    worktreesDirectory,
    stagingDirectory,
    rootPagePathsFile,
  } = docsVersionBuild;
  console.log(
    `\nBuilding ${docsVersion.label} at ${docsVersion.path || "/"} from ${docsVersion.gitRef ?? "the working tree"}`,
  );
  const buildRoot =
    docsVersion.gitRef === null
      ? repositoryRoot
      : prepareTagWorktree({
          repositoryRoot,
          gitRef: docsVersion.gitRef,
          worktreesDirectory,
          shouldInstallDependencies: true,
        });
  const outputDirectory = buildPagesSite({
    repositoryRoot: buildRoot,
    basePath: `${pagesBasePath}${docsVersion.path}`,
    docsVersionKey: docsVersion.key,
    docsVersionsJson,
    rootPagePathsFile,
  });
  if (docsVersion.path !== "") {
    rmSync(join(outputDirectory, "sitemap.xml"), { force: true });
  }
  cpSync(outputDirectory, join(stagingDirectory, docsVersion.path), {
    recursive: true,
  });

  if (docsVersion.gitRef !== null) {
    removeTagWorktree(repositoryRoot, buildRoot);
  }
}

const docsVersions = resolveDocsVersions(listGitTags());
const docsVersionsJson = serialiseDocsVersions(docsVersions);
const workDirectory = mkdtempSync(join(tmpdir(), "sendmock-docs-versions-"));
const worktreesDirectory = join(workDirectory, "worktrees");
const stagingDirectory = join(workDirectory, "site");
mkdirSync(stagingDirectory, { recursive: true });

try {
  const rootVersion = docsVersions.find(
    (docsVersion) => docsVersion.path === "",
  );
  if (rootVersion === undefined) {
    throw new Error("No docs version is served at the site root.");
  }
  buildDocsVersion(rootVersion, {
    docsVersionsJson,
    worktreesDirectory,
    stagingDirectory,
  });

  const rootPagePathsFile = join(workDirectory, "root-page-paths.json");
  const otherVersions = docsVersions.filter(
    (docsVersion) => docsVersion !== rootVersion,
  );
  writeFileSync(
    rootPagePathsFile,
    JSON.stringify(
      listBuiltPagePaths(
        stagingDirectory,
        new Set([
          "demo",
          ...otherVersions.map((docsVersion) => docsVersion.path.slice(1)),
        ]),
      ),
    ),
  );
  for (const docsVersion of otherVersions) {
    buildDocsVersion(docsVersion, {
      docsVersionsJson,
      worktreesDirectory,
      stagingDirectory,
      rootPagePathsFile,
    });
  }

  const finalOutputDirectory = join(repositoryRoot, "website", "out");
  rmSync(finalOutputDirectory, { recursive: true, force: true });
  // A copy, not a rename: the temporary folder can be on another disk.
  cpSync(stagingDirectory, finalOutputDirectory, { recursive: true });
  console.log(
    `\nDocs versions ready in website/out: ${docsVersions
      .map((docsVersion) => `${docsVersion.label} (${docsVersion.path || "/"})`)
      .join(", ")}.`,
  );
} finally {
  runGit(["worktree", "prune"]);
  rmSync(workDirectory, { recursive: true, force: true });
}
