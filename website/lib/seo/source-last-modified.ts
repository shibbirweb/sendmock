import { execFileSync } from "node:child_process";

/** Runs `git` in a checkout and returns what it prints. */
export type GitRunner = (
  gitArguments: string[],
  repositoryRoot: string,
) => string;

function runGit(gitArguments: string[], repositoryRoot: string): string {
  return execFileSync("git", gitArguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** Strict ISO 8601 with an offset, as `git log --format=%cI` prints it. */
const commitDatePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * The date of the last commit that changed any of the files, for the
 * sitemap's lastmod. Undefined when git cannot tell (no git, a shallow
 * clone that misses the file, an untracked path): a wrong date is worse
 * than none, so the page is then listed without one.
 */
export function findLastCommitDate(
  sourcePaths: string[],
  repositoryRoot: string,
  gitRunner: GitRunner = runGit,
): string | undefined {
  try {
    const commitDate = gitRunner(
      ["log", "-1", "--format=%cI", "--", ...sourcePaths],
      repositoryRoot,
    ).trim();

    return commitDatePattern.test(commitDate) ? commitDate : undefined;
  } catch {
    return undefined;
  }
}
