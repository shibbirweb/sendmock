#!/usr/bin/env bun
/**
 * The Chocolatey package for a stable release (`sendmock`, DS-03.4): `sendmock.nuspec` and
 * `tools/chocolateyinstall.ps1`, which downloads the x64 archive and checks its SHA256 from the
 * release's SHA256SUMS. Chocolatey runs x64 tools on Arm64 Windows too. Release build packs and
 * pushes it.
 *
 *     bun scripts/release/chocolatey-package.ts <version> <SHA256SUMS> <output folder> [download URL]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseChecksums } from "./homebrew-formula";

const repositoryUrl = "https://github.com/shibbirweb/sendmock";
const windowsArchiveName = "sendmock-x86_64-pc-windows-msvc.zip";

export function buildChocolateyFiles(
  version: string,
  checksums: Map<string, string>,
  downloadUrl = `${repositoryUrl}/releases/download/v${version}`,
): Map<string, string> {
  const checksum = checksums.get(windowsArchiveName);
  if (checksum === undefined) {
    throw new Error(`SHA256SUMS has no ${windowsArchiveName}`);
  }
  const nuspecText = `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by Release build for ${version}; changes here are overwritten. -->
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>sendmock</id>
    <version>${version}</version>
    <title>SendMock</title>
    <authors>MD. Shibbir Ahmed</authors>
    <projectUrl>https://shibbirweb.github.io/sendmock/</projectUrl>
    <projectSourceUrl>${repositoryUrl}</projectSourceUrl>
    <licenseUrl>${repositoryUrl}#licence</licenseUrl>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <tags>email sms smtp testing webhooks</tags>
    <summary>Catch email, SMS, payments and webhooks from any app on your machine.</summary>
    <description>SendMock catches the email, SMS, payments and webhooks your app sends, on your machine, so nothing reaches real people. Run sendmock and open http://127.0.0.1:8025.</description>
    <releaseNotes>${repositoryUrl}/releases/tag/v${version}</releaseNotes>
  </metadata>
  <files>
    <file src="tools\\**" target="tools" />
  </files>
</package>
`;
  const installScriptText = `# Written by Release build for ${version}; changes here are overwritten.
$ErrorActionPreference = "Stop"
$packageArguments = @{
    packageName    = "sendmock"
    unzipLocation  = Split-Path -Parent $MyInvocation.MyCommand.Definition
    url64bit       = "${downloadUrl}/${windowsArchiveName}"
    checksum64     = "${checksum}"
    checksumType64 = "sha256"
}
Install-ChocolateyZipPackage @packageArguments
`;
  return new Map([
    ["sendmock.nuspec", nuspecText],
    ["tools/chocolateyinstall.ps1", installScriptText],
  ]);
}

if (import.meta.main) {
  const [version, checksumsPath, outputDirectory, downloadUrl] =
    process.argv.slice(2);
  if (!version || !checksumsPath || !outputDirectory) {
    console.error(
      "Usage: bun scripts/release/chocolatey-package.ts <version> <SHA256SUMS> <output folder> [download URL]",
    );
    process.exit(2);
  }
  mkdirSync(join(outputDirectory, "tools"), { recursive: true });
  const packageFiles = buildChocolateyFiles(
    version,
    parseChecksums(readFileSync(checksumsPath, "utf8")),
    downloadUrl,
  );
  for (const [fileName, fileText] of packageFiles) {
    writeFileSync(join(outputDirectory, fileName), fileText);
  }
}
