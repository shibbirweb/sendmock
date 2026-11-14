"use strict";

/**
 * Finds the SendMock binary that the package manager installed for this computer. Each
 * platform's binary is its own package listed in `optionalDependencies` with `os` and `cpu`
 * set, so npm, pnpm, Yarn and Bun install only the one that fits and no install script runs.
 */

const path = require("node:path");

/** `process.platform-process.arch` to the platform package and the binary inside it. */
const platformPackages = {
  "darwin-arm64": "@sendmock/darwin-arm64",
  "darwin-x64": "@sendmock/darwin-x64",
  "linux-arm64": "@sendmock/linux-arm64",
  "linux-x64": "@sendmock/linux-x64",
  "win32-arm64": "@sendmock/win32-arm64",
  "win32-x64": "@sendmock/win32-x64",
};

function findPlatformPackage(platform, cpu) {
  return platformPackages[`${platform}-${cpu}`] ?? null;
}

function readBinaryName(platform) {
  return platform === "win32" ? "sendmock.exe" : "sendmock";
}

/**
 * The binary's path, or an error message saying what is missing. `resolvePackageJson` is
 * `require.resolve`, passed in so tests can give their own.
 */
function locateBinary(platform, cpu, resolvePackageJson) {
  const platformPackage = findPlatformPackage(platform, cpu);
  if (platformPackage === null) {
    return {
      errorMessage: `SendMock has no build for ${platform} on ${cpu}. Builds exist for ${Object.keys(platformPackages).join(", ")}.`,
    };
  }
  try {
    const packageJsonPath = resolvePackageJson(
      `${platformPackage}/package.json`,
    );
    return {
      binaryPath: path.join(
        path.dirname(packageJsonPath),
        readBinaryName(platform),
      ),
    };
  } catch {
    return {
      errorMessage: `The ${platformPackage} package is missing. Install sendmock again without --no-optional (or --omit=optional), so the package manager adds the binary for this computer.`,
    };
  }
}

/**
 * The binary's environment: this one, plus a mark that npm started it, so
 * `npx sendmock ai install` writes agent configurations that also start SendMock through npx.
 */
function buildBinaryEnvironment(parentEnvironment) {
  return { ...parentEnvironment, SENDMOCK_LAUNCHER: "npm" };
}

module.exports = {
  buildBinaryEnvironment,
  findPlatformPackage,
  locateBinary,
  platformPackages,
};
