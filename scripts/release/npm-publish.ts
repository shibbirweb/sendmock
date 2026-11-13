#!/usr/bin/env bun
/**
 * Publishes one npm package folder (DS-03.8). npm sets a trusted publisher only on a package
 * that exists, so a package not yet on npm is staged with `npm stage publish` (any token can
 * stage it, and the owner approves it with 2FA on npmjs.com); every other package is published.
 *
 *     bun scripts/release/npm-publish.ts <package folder> <dist tag>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type NpmPackageState = "published" | "new";

type FetchPackage = (packageUrl: string) => Promise<Response>;

export function buildRegistryPackageUrl(packageName: string): string {
  return `https://registry.npmjs.org/${packageName.replace("/", "%2f")}`;
}

/** Whether npm has the package, failing on any other answer so a registry outage never stages. */
export async function readNpmPackageState(
  packageName: string,
  fetchPackage: FetchPackage = fetch,
): Promise<NpmPackageState> {
  const registryResponse = await fetchPackage(
    buildRegistryPackageUrl(packageName),
  );
  if (registryResponse.status === 404) {
    return "new";
  }
  if (!registryResponse.ok) {
    throw new Error(
      `npm answered ${registryResponse.status} for ${packageName}; not publishing.`,
    );
  }

  return "published";
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

async function publishPackageFolder(packageFolder: string, distTag: string) {
  const { name: packageName } = JSON.parse(
    readFileSync(join(packageFolder, "package.json"), "utf8"),
  ) as { name: string };
  const packageState = await readNpmPackageState(packageName);
  if (packageState === "new") {
    console.log(
      `${packageName} is not on npm yet: staging it for the owner to approve on npmjs.com.`,
    );
  }
  const npmProcess = Bun.spawnSync(
    ["npm", ...buildNpmPublishArguments(packageState, packageFolder, distTag)],
    { stdout: "inherit", stderr: "inherit" },
  );

  return npmProcess.exitCode;
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
