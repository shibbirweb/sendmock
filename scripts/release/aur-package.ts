#!/usr/bin/env bun
/**
 * The AUR package for a release (DS-03.5): the `PKGBUILD` of `sendmock-bin` for a stable or
 * `sendmock-beta-bin` for a beta, from the release's SHA256SUMS. Release build writes its
 * `.SRCINFO` with `makepkg --printsrcinfo` in an Arch container and pushes both to
 * aur.archlinux.org.
 *
 *     bun scripts/release/aur-package.ts <version> <channel> <SHA256SUMS> <output folder> [download URL]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseChecksums } from "./homebrew-formula";

const repositoryUrl = "https://github.com/shibbirweb/sendmock";
const packageDescription =
  "Catch email, SMS, payments and webhooks from any app on your machine";

const aurArchitectures = [
  { architecture: "x86_64", target: "x86_64-unknown-linux-musl" },
  { architecture: "aarch64", target: "aarch64-unknown-linux-musl" },
] as const;

export function readAurPackageName(channel: string): string {
  return channel === "beta" ? "sendmock-beta-bin" : "sendmock-bin";
}

/** pacman's versions cannot hold `-`; `1.1.0beta1` sorts before `1.1.0`, as a beta should. */
export function toPacmanVersion(version: string): string {
  return version.replace(/-beta\.(\d+)$/, "beta$1");
}

function readArchitectureSources(
  version: string,
  checksums: Map<string, string>,
  downloadUrl: string,
) {
  return aurArchitectures.map(({ architecture, target }) => {
    const archiveName = `sendmock-${target}.tar.gz`;
    const checksum = checksums.get(archiveName);
    if (checksum === undefined) {
      throw new Error(`SHA256SUMS has no ${archiveName}`);
    }
    return {
      architecture,
      source: `sendmock-${version}-${architecture}.tar.gz::${downloadUrl}/${archiveName}`,
      checksum,
    };
  });
}

export function buildAurPackage(
  version: string,
  channel: string,
  checksums: Map<string, string>,
  downloadUrl = `${repositoryUrl}/releases/download/v${version}`,
): string {
  const packageName = readAurPackageName(channel);
  const otherPackageName =
    channel === "beta" ? "sendmock-bin" : "sendmock-beta-bin";
  const pacmanVersion = toPacmanVersion(version);
  const architectureSources = readArchitectureSources(
    version,
    checksums,
    downloadUrl,
  );
  return `# Maintainer: MD. Shibbir Ahmed <shibbirweb@gmail.com>
# Written by SendMock's Release build for ${version}; changes here are overwritten.
pkgname=${packageName}
pkgver=${pacmanVersion}
pkgrel=1
pkgdesc="${packageDescription}"
arch=('x86_64' 'aarch64')
url="https://shibbirweb.github.io/sendmock/"
license=('MIT' 'Apache-2.0')
provides=('sendmock')
conflicts=('sendmock' '${otherPackageName}')
options=('!strip' '!debug')
${architectureSources.map(({ architecture, source }) => `source_${architecture}=("${source}")`).join("\n")}
${architectureSources.map(({ architecture, checksum }) => `sha256sums_${architecture}=('${checksum}')`).join("\n")}

package() {
  install -Dm755 sendmock "$pkgdir/usr/bin/sendmock"
  install -Dm644 LICENSE-MIT "$pkgdir/usr/share/licenses/$pkgname/LICENSE-MIT"
  install -Dm644 LICENSE-APACHE "$pkgdir/usr/share/licenses/$pkgname/LICENSE-APACHE"
  install -Dm644 README.md "$pkgdir/usr/share/doc/$pkgname/README.md"
}
`;
}

if (import.meta.main) {
  const [version, channel, checksumsPath, outputDirectory, downloadUrl] =
    process.argv.slice(2);
  if (!version || !channel || !checksumsPath || !outputDirectory) {
    console.error(
      "Usage: bun scripts/release/aur-package.ts <version> <channel> <SHA256SUMS> <output folder> [download URL]",
    );
    process.exit(2);
  }
  const pkgbuild = buildAurPackage(
    version,
    channel,
    parseChecksums(readFileSync(checksumsPath, "utf8")),
    downloadUrl,
  );
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, "PKGBUILD"), pkgbuild);
}
