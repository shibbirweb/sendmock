#!/usr/bin/env bun
/**
 * The Nix package for a stable release (DS-03.5): `package.nix`, which installs the release's
 * binary for the four systems Nixpkgs builds, with each archive's hash from SHA256SUMS. The owner
 * opens the first Nixpkgs pull request with it; after that Nixpkgs' update bot follows releases.
 * Release build attaches it to each stable release.
 *
 *     bun scripts/release/nix-package.ts <version> <SHA256SUMS> [download URL]
 */
import { readFileSync } from "node:fs";

import { parseChecksums } from "./homebrew-formula";

const repositoryUrl = "https://github.com/shibbirweb/sendmock";

const nixSystems = [
  { system: "aarch64-darwin", target: "aarch64-apple-darwin" },
  { system: "aarch64-linux", target: "aarch64-unknown-linux-musl" },
  { system: "x86_64-darwin", target: "x86_64-apple-darwin" },
  { system: "x86_64-linux", target: "x86_64-unknown-linux-musl" },
] as const;

/** Nix writes hashes as SRI: `sha256-` and the digest in base64. */
export function toSriHash(hexChecksum: string): string {
  if (!/^[0-9a-f]{64}$/i.test(hexChecksum)) {
    throw new Error(`${hexChecksum} is not a SHA256 checksum`);
  }
  return `sha256-${Buffer.from(hexChecksum, "hex").toString("base64")}`;
}

export function buildNixPackage(
  version: string,
  checksums: Map<string, string>,
  downloadUrl = `${repositoryUrl}/releases/download/v\${version}`,
): string {
  const systemEntries = nixSystems.map(({ system, target }) => {
    const archiveName = `sendmock-${target}.tar.gz`;
    const checksum = checksums.get(archiveName);
    if (checksum === undefined) {
      throw new Error(`SHA256SUMS has no ${archiveName}`);
    }
    return `    ${system} = {\n      target = "${target}";\n      hash = "${toSriHash(checksum)}";\n    };`;
  });
  return `# Written by SendMock's Release build for ${version}.
{
  lib,
  stdenvNoCC,
  fetchurl,
}:

let
  version = "${version}";
  sources = {
${systemEntries.join("\n")}
  };
  source =
    sources.\${stdenvNoCC.hostPlatform.system}
      or (throw "sendmock has no build for \${stdenvNoCC.hostPlatform.system}");
in
stdenvNoCC.mkDerivation {
  pname = "sendmock";
  inherit version;

  src = fetchurl {
    url = "${downloadUrl}/sendmock-\${source.target}.tar.gz";
    inherit (source) hash;
  };
  sourceRoot = ".";

  installPhase = ''
    runHook preInstall
    install -Dm755 sendmock $out/bin/sendmock
    runHook postInstall
  '';

  meta = {
    description = "Catch email, SMS, payments and webhooks from any app on your machine";
    homepage = "https://shibbirweb.github.io/sendmock/";
    changelog = "${repositoryUrl}/releases/tag/v\${version}";
    license = with lib.licenses; [
      mit
      asl20
    ];
    mainProgram = "sendmock";
    platforms = builtins.attrNames sources;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
  };
}
`;
}

if (import.meta.main) {
  const [version, checksumsPath, downloadUrl] = process.argv.slice(2);
  if (!version || !checksumsPath) {
    console.error(
      "Usage: bun scripts/release/nix-package.ts <version> <SHA256SUMS> [download URL]",
    );
    process.exit(2);
  }
  process.stdout.write(
    buildNixPackage(
      version,
      parseChecksums(readFileSync(checksumsPath, "utf8")),
      downloadUrl,
    ),
  );
}
