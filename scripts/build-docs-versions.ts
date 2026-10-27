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
 * copied over it, so the working tree is never changed (WS-03.5).
 * Output: website/out (upload it as the Pages artifact).
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  type DocsVersion,
  resolveDocsVersions,
} from "../website/lib/docs-versions";
import { buildPagesSite } from "./build-pages-site";

const repositoryRoot = join(import.meta.dir, "..");
const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");

/** Top-level website/ entries (build output, dependencies) a tag's worktree must not get. */
const websiteCopySkips = new Set([
  "node_modules",
  ".next",
  ".source",
  "out",
  "content",
  "test-results",
  ".lighthouseci",
]);

function runGit(gitArguments: string[], workingDirectory = repositoryRoot) {
  return execFileSync("git", gitArguments, {
    cwd: workingDirectory,
    encoding: "utf8",
  });
}

function runBunInstall(workingDirectory: string) {
  execFileSync("bun", ["install", "--frozen-lockfile"], {
    cwd: workingDirectory,
    stdio: "inherit",
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

/** A worktree of the tag, with today's website/ in place of the tag's own. */
function prepareTagWorktree(gitRef: string, worktreesDirectory: string) {
  const worktreeRoot = join(worktreesDirectory, gitRef);
  runGit(["worktree", "add", "--detach", worktreeRoot, gitRef]);
  rmSync(join(worktreeRoot, "website"), { recursive: true, force: true });
  const currentWebsiteDirectory = join(repositoryRoot, "website");
  cpSync(currentWebsiteDirectory, join(worktreeRoot, "website"), {
    recursive: true,
    filter: (sourcePath) =>
      !websiteCopySkips.has(relative(currentWebsiteDirectory, sourcePath)),
  });
  runBunInstall(join(worktreeRoot, "web"));
  runBunInstall(join(worktreeRoot, "website"));

  return worktreeRoot;
}

function buildDocsVersion(
  docsVersion: DocsVersion,
  docsVersionsJson: string,
  worktreesDirectory: string,
  stagingDirectory: string,
) {
  console.log(
    `\nBuilding ${docsVersion.label} at ${docsVersion.path || "/"} from ${docsVersion.gitRef ?? "the working tree"}`,
  );
  const buildRoot =
    docsVersion.gitRef === null
      ? repositoryRoot
      : prepareTagWorktree(docsVersion.gitRef, worktreesDirectory);
  const outputDirectory = buildPagesSite({
    repositoryRoot: buildRoot,
    basePath: `${pagesBasePath}${docsVersion.path}`,
    docsVersionKey: docsVersion.key,
    docsVersionsJson,
  });
  cpSync(outputDirectory, join(stagingDirectory, docsVersion.path), {
    recursive: true,
  });

  if (docsVersion.gitRef !== null) {
    runGit(["worktree", "remove", "--force", buildRoot]);
  }
}

const docsVersions = resolveDocsVersions(listGitTags());
const docsVersionsJson = serialiseDocsVersions(docsVersions);
const workDirectory = mkdtempSync(join(tmpdir(), "sendmock-docs-versions-"));
const worktreesDirectory = join(workDirectory, "worktrees");
const stagingDirectory = join(workDirectory, "site");
mkdirSync(stagingDirectory, { recursive: true });

try {
  for (const docsVersion of docsVersions) {
    buildDocsVersion(
      docsVersion,
      docsVersionsJson,
      worktreesDirectory,
      stagingDirectory,
    );
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
