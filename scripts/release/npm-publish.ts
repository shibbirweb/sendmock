#!/usr/bin/env bun
/**
 * Publishes one npm package folder (DS-03.8). npm sets a trusted publisher only on a package
 * that exists, so a package not yet on npm is staged with `npm stage publish` (any token can
 * stage it, and the owner approves it with 2FA on npmjs.com); every other package is published.
 * Until a stable version exists, a beta also becomes `latest`, so `npx sendmock` without a tag
 * runs it instead of npm's staging placeholder (`0.0.0-stage`).
 *
 *     bun scripts/release/npm-publish.ts <package folder> <dist tag>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type NpmPackageState = "published" | "new";

export type NpmPackageRecord = {
  state: NpmPackageState;
  latestVersion: string | null;
};

type FetchPackage = (packageUrl: string) => Promise<Response>;

export function buildRegistryPackageUrl(packageName: string): string {
  return `https://registry.npmjs.org/${packageName.replaceAll("/", "%2f")}`;
}

/** Whether npm has the package and its `latest` version, failing on any other answer so a registry outage never stages. */
export async function readNpmPackageRecord(
  packageName: string,
  fetchPackage: FetchPackage = fetch,
): Promise<NpmPackageRecord> {
  const registryResponse = await fetchPackage(
    buildRegistryPackageUrl(packageName),
  );
  if (registryResponse.status === 404) {
    return { state: "new", latestVersion: null };
  }
  if (!registryResponse.ok) {
    throw new Error(
      `npm answered ${registryResponse.status} for ${packageName}; not publishing.`,
    );
  }
  const packageDocument = (await registryResponse.json()) as {
    "dist-tags"?: { latest?: string };
  };

  return {
    state: "published",
    latestVersion: packageDocument["dist-tags"]?.latest ?? null,
  };
}

export async function readNpmPackageState(
  packageName: string,
  fetchPackage: FetchPackage = fetch,
): Promise<NpmPackageState> {
  return (await readNpmPackageRecord(packageName, fetchPackage)).state;
}

/** A beta becomes `latest` only while `latest` is missing or a prerelease, so never over a stable. */
export function shouldMoveLatestTag(
  distTag: string,
  latestVersion: string | null,
): boolean {
  if (distTag === "latest") {
    return false;
  }

  return latestVersion === null || latestVersion.includes("-");
}

export function buildNpmLatestTagArguments(
  packageName: string,
  packageVersion: string,
): string[] {
  return ["dist-tag", "add", `${packageName}@${packageVersion}`, "latest"];
}

/** A folder as npm reads it: `npm-packages/sendmock` alone is a GitHub repository to npm. */
export function toNpmFolderSpec(packageFolder: string): string {
  const folderWithSlash = packageFolder.endsWith("/")
    ? packageFolder
    : `${packageFolder}/`;
  if (folderWithSlash.startsWith("./") || folderWithSlash.startsWith("/")) {
    return folderWithSlash;
  }

  return `./${folderWithSlash}`;
}

export function buildNpmPublishArguments(
  packageState: NpmPackageState,
  packageFolder: string,
  distTag: string,
): string[] {
  const publishCommand =
    packageState === "new" ? ["stage", "publish"] : ["publish"];

  return [
    ...publishCommand,
    toNpmFolderSpec(packageFolder),
    "--access",
    "public",
    "--tag",
    distTag,
  ];
}

function runNpm(npmArguments: string[]): number {
  return Bun.spawnSync(["npm", ...npmArguments], {
    stdout: "inherit",
    stderr: "inherit",
  }).exitCode;
}

// The version is already published when this runs, so a refused tag (the trusted publisher
// without "Allow npm dist-tag") warns instead of failing the release.
function moveLatestTag(packageName: string, packageVersion: string) {
  const exitCode = runNpm(
    buildNpmLatestTagArguments(packageName, packageVersion),
  );
  if (exitCode !== 0) {
    console.log(
      `::warning::npm refused to move latest to ${packageName}@${packageVersion}; allow npm dist-tag on its trusted publisher.`,
    );
  }
}

async function publishPackageFolder(packageFolder: string, distTag: string) {
  const { name: packageName, version: packageVersion } = JSON.parse(
    readFileSync(join(packageFolder, "package.json"), "utf8"),
  ) as { name: string; version: string };
  const { state: packageState, latestVersion } =
    await readNpmPackageRecord(packageName);
  if (packageState === "new") {
    console.log(
      `${packageName} is not on npm yet: staging it for the owner to approve on npmjs.com.`,
    );
  }
  const publishExitCode = runNpm(
    buildNpmPublishArguments(packageState, packageFolder, distTag),
  );
  // A staged version is not live until the owner approves it, so it cannot be tagged yet.
  if (
    publishExitCode === 0 &&
    packageState === "published" &&
    shouldMoveLatestTag(distTag, latestVersion)
  ) {
    moveLatestTag(packageName, packageVersion);
  }

  return publishExitCode;
}

if (import.meta.main) {
  const [packageFolder, distTag] = process.argv.slice(2);
  if (!packageFolder || !distTag) {
    console.error(
      "Usage: bun scripts/release/npm-publish.ts <package folder> <dist tag>",
    );
    process.exit(2);
  }
  process.exit(await publishPackageFolder(packageFolder, distTag));
}
