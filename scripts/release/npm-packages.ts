#!/usr/bin/env bun
/**
 * The npm packages for a release (DS-03.1): `sendmock`, the launcher from
 * packaging/npm/sendmock, and one `@sendmock/<platform>` package per target holding only
 * that target's binary, unpacked from the tested archives.
 *
 *     bun scripts/release/npm-packages.ts <version> <archives folder> <output folder> [target]
 *
 * With a target, only that platform's package is written beside the launcher (the release
 * tests install the two on their own runner).
 */
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repository = {
  type: "git",
  url: "git+https://github.com/shibbirweb/sendmock.git",
};

export const npmPlatforms = [
  {
    platformKey: "darwin-arm64",
    os: "darwin",
    cpu: "arm64",
    target: "aarch64-apple-darwin",
  },
  {
    platformKey: "darwin-x64",
    os: "darwin",
    cpu: "x64",
    target: "x86_64-apple-darwin",
  },
  {
    platformKey: "linux-arm64",
    os: "linux",
    cpu: "arm64",
    target: "aarch64-unknown-linux-musl",
  },
  {
    platformKey: "linux-x64",
    os: "linux",
    cpu: "x64",
    target: "x86_64-unknown-linux-musl",
  },
  {
    platformKey: "win32-arm64",
    os: "win32",
    cpu: "arm64",
    target: "aarch64-pc-windows-msvc",
  },
  {
    platformKey: "win32-x64",
    os: "win32",
    cpu: "x64",
    target: "x86_64-pc-windows-msvc",
  },
] as const;

type NpmPlatform = (typeof npmPlatforms)[number];

export function buildLauncherPackageJson(version: string) {
  return {
    name: "sendmock",
    version,
    description:
      "Catch email, SMS, payments and webhooks from any app on your machine.",
    homepage: "https://shibbirweb.github.io/sendmock/",
    license: "MIT OR Apache-2.0",
    repository,
    bin: { sendmock: "bin/sendmock.js" },
    files: ["bin", "lib", "README.md"],
    engines: { node: ">=18" },
    // The MCP registry checks this name against server.json.
    mcpName: "io.github.shibbirweb/sendmock",
    optionalDependencies: Object.fromEntries(
      npmPlatforms.map((npmPlatform) => [
        `@sendmock/${npmPlatform.platformKey}`,
        version,
      ]),
    ),
  };
}

export function buildPlatformPackageJson(
  version: string,
  npmPlatform: NpmPlatform,
) {
  const binaryName = npmPlatform.os === "win32" ? "sendmock.exe" : "sendmock";
  return {
    name: `@sendmock/${npmPlatform.platformKey}`,
    version,
    description: `The SendMock binary for ${npmPlatform.os} on ${npmPlatform.cpu}; install the sendmock package instead.`,
    homepage: "https://shibbirweb.github.io/sendmock/",
    license: "MIT OR Apache-2.0",
    repository,
    os: [npmPlatform.os],
    cpu: [npmPlatform.cpu],
    files: [binaryName],
    preferUnplugged: true,
  };
}

function writePackageJson(packageDirectory: string, packageJson: object) {
  writeFileSync(
    join(packageDirectory, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
}

function unpackBinary(
  npmPlatform: NpmPlatform,
  archivesDirectory: string,
  packageDirectory: string,
) {
  const isWindows = npmPlatform.os === "win32";
  const archivePath = join(
    archivesDirectory,
    `sendmock-${npmPlatform.target}.${isWindows ? "zip" : "tar.gz"}`,
  );
  const extractDirectory = mkdtempSync(join(tmpdir(), "sendmock-npm-"));
  // GNU tar on Linux cannot read zip files; bsdtar on macOS and Windows can.
  const unpackCommand =
    isWindows && process.platform === "linux"
      ? ["unzip", "-q", "-o", archivePath, "-d", extractDirectory]
      : ["tar", "-xf", archivePath, "-C", extractDirectory];
  const unpackResult = Bun.spawnSync(unpackCommand);
  if (unpackResult.exitCode !== 0) {
    throw new Error(
      `could not unpack ${archivePath}: ${unpackResult.stderr.toString()}`,
    );
  }
  const binaryName = isWindows ? "sendmock.exe" : "sendmock";
  cpSync(
    join(extractDirectory, binaryName),
    join(packageDirectory, binaryName),
  );
}

export function writeNpmPackages(
  version: string,
  archivesDirectory: string,
  outputDirectory: string,
  onlyTarget?: string,
) {
  const launcherDirectory = join(outputDirectory, "sendmock");
  cpSync(
    join(import.meta.dir, "../../packaging/npm/sendmock"),
    launcherDirectory,
    {
      recursive: true,
    },
  );
  writePackageJson(launcherDirectory, buildLauncherPackageJson(version));
  for (const npmPlatform of npmPlatforms) {
    if (onlyTarget !== undefined && npmPlatform.target !== onlyTarget) {
      continue;
    }
    const packageDirectory = join(outputDirectory, npmPlatform.platformKey);
    mkdirSync(packageDirectory, { recursive: true });
    unpackBinary(npmPlatform, archivesDirectory, packageDirectory);
    writePackageJson(
      packageDirectory,
      buildPlatformPackageJson(version, npmPlatform),
    );
  }
}

if (import.meta.main) {
  const [version, archivesDirectory, outputDirectory, onlyTarget] =
    process.argv.slice(2);
  if (!version || !archivesDirectory || !outputDirectory) {
    console.error(
      "Usage: bun scripts/release/npm-packages.ts <version> <archives folder> <output folder> [target]",
    );
    process.exit(2);
  }
  writeNpmPackages(version, archivesDirectory, outputDirectory, onlyTarget);
}
