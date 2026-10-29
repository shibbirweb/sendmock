#!/usr/bin/env bun
/**
 * The Homebrew formula for a release (`sendmock` for stable, `sendmock-beta` for beta),
 * from the release's SHA256SUMS (DS-03.1). Release build pushes it to the tap.
 *
 *     bun scripts/release/homebrew-formula.ts <version> <channel> <SHA256SUMS>
 */
import { readFileSync } from "node:fs";

const releaseDownloadUrl =
  "https://github.com/shibbirweb/sendmock/releases/download";

/** Homebrew's platform blocks, in the order the formula lists them, and their archives. */
const formulaPlatforms = [
  { os: "on_macos", cpu: "on_arm", target: "aarch64-apple-darwin" },
  { os: "on_macos", cpu: "on_intel", target: "x86_64-apple-darwin" },
  { os: "on_linux", cpu: "on_arm", target: "aarch64-unknown-linux-musl" },
  { os: "on_linux", cpu: "on_intel", target: "x86_64-unknown-linux-musl" },
] as const;

export function readFormulaName(channel: string): string {
  return channel === "beta" ? "sendmock-beta" : "sendmock";
}

/** `sendmock-beta` becomes `SendmockBeta`, the class name Homebrew expects. */
function toFormulaClassName(formulaName: string): string {
  return formulaName
    .split("-")
    .map((namePart) => namePart.charAt(0).toUpperCase() + namePart.slice(1))
    .join("");
}

/** `hash  file name` lines to a map from file name to hash. */
export function parseChecksums(checksumsText: string): Map<string, string> {
  return new Map(
    checksumsText
      .split("\n")
      .map((checksumLine) => checksumLine.trim().split(/\s+/))
      .filter(
        (lineParts): lineParts is [string, string] => lineParts.length === 2,
      )
      .map(([checksum, fileName]) => [fileName.replace(/^\*/, ""), checksum]),
  );
}

export function buildHomebrewFormula(
  version: string,
  channel: string,
  checksums: Map<string, string>,
): string {
  const formulaName = readFormulaName(channel);
  const platformBlocks = ["on_macos", "on_linux"].map((osBlock) => {
    const cpuBlocks = formulaPlatforms
      .filter((platform) => platform.os === osBlock)
      .map((platform) => {
        const archiveName = `sendmock-${platform.target}.tar.gz`;
        const checksum = checksums.get(archiveName);
        if (checksum === undefined) {
          throw new Error(`SHA256SUMS has no ${archiveName}`);
        }
        return [
          `    ${platform.cpu} do`,
          `      url "${releaseDownloadUrl}/v${version}/${archiveName}"`,
          `      sha256 "${checksum}"`,
          "    end",
        ].join("\n");
      });
    return [`  ${osBlock} do`, ...cpuBlocks, "  end"].join("\n");
  });
  const otherFormula = channel === "beta" ? "sendmock" : "sendmock-beta";

  return `# Written by Release build for ${version}; changes here are overwritten.
class ${toFormulaClassName(formulaName)} < Formula
  desc "Catch email, SMS, payments and webhooks from any app on your machine"
  homepage "https://github.com/shibbirweb/sendmock"
  version "${version}"
  license any_of: ["MIT", "Apache-2.0"]

${platformBlocks.join("\n\n")}

  conflicts_with "${otherFormula}", because: "both install a \`sendmock\` binary"

  def install
    bin.install "sendmock"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/sendmock version")
  end
end
`;
}

if (import.meta.main) {
  const [version, channel, checksumsPath] = process.argv.slice(2);
  if (!version || !channel || !checksumsPath) {
    console.error(
      "Usage: bun scripts/release/homebrew-formula.ts <version> <channel> <SHA256SUMS>",
    );
    process.exit(2);
  }
  process.stdout.write(
    buildHomebrewFormula(
      version,
      channel,
      parseChecksums(readFileSync(checksumsPath, "utf8")),
    ),
  );
}
