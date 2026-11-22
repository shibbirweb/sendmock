// Prints `is_affected=true` or `is_affected=false` for a step output: whether a pull request
// changed a file matching one of a workflow's path patterns (PATH_PATTERNS, one per line).
import { readFileSync } from "node:fs";

/** GitHub lists at most this many files of a pull request; a larger one counts as affected. */
const githubFileListLimit = 3000;

export function readPathPatterns(patternText: string): string[] {
  return patternText
    .split("\n")
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern !== "");
}

export function isAnyPathAffected(
  changedFiles: string[],
  pathPatterns: string[],
): boolean {
  if (changedFiles.length >= githubFileListLimit) {
    return true;
  }
  const pathGlobs = pathPatterns.map((pattern) => new Bun.Glob(pattern));
  return changedFiles.some((changedFile) =>
    pathGlobs.some((pathGlob) => pathGlob.match(changedFile)),
  );
}

if (import.meta.main) {
  const changedFilesPath = process.argv[2];
  if (changedFilesPath === undefined) {
    console.error("Usage: bun scripts/ci/changed-paths.ts <changed-files.txt>");
    process.exit(2);
  }
  const pathPatterns = readPathPatterns(process.env.PATH_PATTERNS ?? "");
  if (pathPatterns.length === 0) {
    console.error("PATH_PATTERNS is empty; a workflow must name its paths");
    process.exit(2);
  }
  const changedFiles = readPathPatterns(readFileSync(changedFilesPath, "utf8"));
  console.log(
    `is_affected=${isAnyPathAffected(changedFiles, pathPatterns)}`,
  );
}
