/**
 * A git worktree of a released tag with today's website/ copied over it, so a
 * docs version is built from the tag's own docs/wiki, docs/api and web/ with the
 * current site look (WS-03.5). The working tree is never changed.
 */

import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

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

export type TagWorktreeOptions = {
  repositoryRoot: string;
  gitRef: string;
  worktreesDirectory: string;
  /** Off in tests: the build needs each folder's dependencies installed. */
  shouldInstallDependencies: boolean;
};

function runGit(gitArguments: string[], workingDirectory: string) {
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

/** Returns the worktree's root, ready for `buildPagesSite`. */
export function prepareTagWorktree(
  tagWorktreeOptions: TagWorktreeOptions,
): string {
  const { repositoryRoot, gitRef, worktreesDirectory } = tagWorktreeOptions;
  const worktreeRoot = join(worktreesDirectory, gitRef);
  runGit(["worktree", "add", "--detach", worktreeRoot, gitRef], repositoryRoot);

  const currentWebsiteDirectory = join(repositoryRoot, "website");
  rmSync(join(worktreeRoot, "website"), { recursive: true, force: true });
  cpSync(currentWebsiteDirectory, join(worktreeRoot, "website"), {
    recursive: true,
    filter: (sourcePath) =>
      !websiteCopySkips.has(relative(currentWebsiteDirectory, sourcePath)),
  });

  if (tagWorktreeOptions.shouldInstallDependencies) {
    runBunInstall(join(worktreeRoot, "web"));
    runBunInstall(join(worktreeRoot, "website"));
  }

  return worktreeRoot;
}

export function removeTagWorktree(
  repositoryRoot: string,
  worktreeRoot: string,
) {
  runGit(["worktree", "remove", "--force", worktreeRoot], repositoryRoot);
}
