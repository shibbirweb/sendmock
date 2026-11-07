import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { type ChangelogRelease, parseChangelog } from "./parse-changelog";

/** The repository's `CHANGELOG.md`, read when the site is built; none before the first release. */
export function loadChangelog(): ChangelogRelease[] {
  const changelogPath = join(process.cwd(), "../CHANGELOG.md");
  return existsSync(changelogPath)
    ? parseChangelog(readFileSync(changelogPath, "utf8"))
    : [];
}
