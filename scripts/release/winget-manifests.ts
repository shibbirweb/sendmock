#!/usr/bin/env bun
/**
 * The WinGet manifests for a stable release (`shibbirweb.sendmock`, DS-03.4): the version,
 * installer and default locale files, from the release's SHA256SUMS. Release build submits
 * them to microsoft/winget-pkgs.
 *
 *     bun scripts/release/winget-manifests.ts <version> <SHA256SUMS> <output folder> [download URL]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseChecksums } from "./homebrew-formula";

export const wingetPackageIdentifier = "shibbirweb.sendmock";
const manifestVersion = "1.10.0";
const repositoryUrl = "https://github.com/shibbirweb/sendmock";

const wingetArchitectures = [
  { architecture: "x64", target: "x86_64-pc-windows-msvc" },
  { architecture: "arm64", target: "aarch64-pc-windows-msvc" },
] as const;

function writeManifestHeader(manifestType: string): string {
  return `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${manifestType}.${manifestVersion}.schema.json\n# Written by Release build; changes here are overwritten.\n`;
}

/** File name to contents, for the folder winget-pkgs keeps them in. */
export function buildWingetManifests(
  version: string,
  checksums: Map<string, string>,
  downloadUrl = `${repositoryUrl}/releases/download/v${version}`,
): Map<string, string> {
  const identityLines = `PackageIdentifier: ${wingetPackageIdentifier}\nPackageVersion: ${version}\n`;
  const installerEntries = wingetArchitectures.map(
    ({ architecture, target }) => {
      const archiveName = `sendmock-${target}.zip`;
      const checksum = checksums.get(archiveName);
      if (checksum === undefined) {
        throw new Error(`SHA256SUMS has no ${archiveName}`);
      }
      return `  - Architecture: ${architecture}\n    InstallerUrl: ${downloadUrl}/${archiveName}\n    InstallerSha256: ${checksum.toUpperCase()}\n`;
    },
  );
  return new Map([
    [
      `${wingetPackageIdentifier}.yaml`,
      `${writeManifestHeader("version")}${identityLines}DefaultLocale: en-US\nManifestType: version\nManifestVersion: ${manifestVersion}\n`,
    ],
    [
      `${wingetPackageIdentifier}.installer.yaml`,
      `${writeManifestHeader("installer")}${identityLines}InstallerType: zip\nNestedInstallerType: portable\nNestedInstallerFiles:\n  - RelativeFilePath: sendmock.exe\n    PortableCommandAlias: sendmock\nInstallers:\n${installerEntries.join("")}ManifestType: installer\nManifestVersion: ${manifestVersion}\n`,
    ],
    [
      `${wingetPackageIdentifier}.locale.en-US.yaml`,
      `${writeManifestHeader("defaultLocale")}${identityLines}PackageLocale: en-US\nPublisher: MD. Shibbir Ahmed\nPublisherUrl: https://github.com/shibbirweb\nPackageName: SendMock\nPackageUrl: https://shibbirweb.github.io/sendmock/\nLicense: MIT OR Apache-2.0\nLicenseUrl: ${repositoryUrl}#licence\nShortDescription: Catch email, SMS, payments and webhooks from any app on your machine.\nMoniker: sendmock\nTags:\n  - email\n  - sms\n  - smtp\n  - testing\n  - webhooks\nReleaseNotesUrl: ${repositoryUrl}/releases/tag/v${version}\nManifestType: defaultLocale\nManifestVersion: ${manifestVersion}\n`,
    ],
  ]);
}

if (import.meta.main) {
  const [version, checksumsPath, outputDirectory, downloadUrl] =
    process.argv.slice(2);
  if (!version || !checksumsPath || !outputDirectory) {
    console.error(
      "Usage: bun scripts/release/winget-manifests.ts <version> <SHA256SUMS> <output folder> [download URL]",
    );
    process.exit(2);
  }
  mkdirSync(outputDirectory, { recursive: true });
  const manifests = buildWingetManifests(
    version,
    parseChecksums(readFileSync(checksumsPath, "utf8")),
    downloadUrl,
  );
  for (const [fileName, manifestText] of manifests) {
    writeFileSync(join(outputDirectory, fileName), manifestText);
  }
}
