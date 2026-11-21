import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseChangelogReleases } from "../../../src/mocks/updates/changelog-releases";

/**
 * What the demo's update check is built from (`src/mocks/updates/mock-releases.ts`),
 * read the same way, so the tests follow each release without edits.
 */
const webDirectory = fileURLToPath(new URL("../../..", import.meta.url));

const builtAppVersion: string = (
  JSON.parse(readFileSync(join(webDirectory, "package.json"), "utf8")) as {
    version: string;
  }
).version;
const stableReleases = parseChangelogReleases(
  readFileSync(join(webDirectory, "../CHANGELOG.md"), "utf8"),
);
const latestStableRelease = stableReleases[0];
if (latestStableRelease === undefined) {
  throw new Error("CHANGELOG.md has no dated stable release.");
}

export const demoReleases = {
  /** The version the demo reports by default. */
  builtAppVersion,
  builtAppChannel: builtAppVersion.includes("-") ? "beta" : "stable",
  /** What older pretend installs are offered. */
  latestStableVersion: latestStableRelease.version,
  /** The first `###` heading line of the latest stable's notes; the release notes show the raw Markdown. */
  latestStableNotesHeadingLine:
    /^### .+$/m.exec(latestStableRelease.notesMarkdown)?.[0] ?? "",
};
