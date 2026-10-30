import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Every file that carries the version; the workspace Cargo.toml is the source of truth. */
export const workspaceManifestPath = "Cargo.toml";
const cargoLockPath = "Cargo.lock";
const packageManifestPaths = ["web/package.json", "website/package.json"];

const workspaceVersionPattern =
  /(\[workspace\.package\][^[]*?\nversion = ")([^"]+)(")/;
const workspaceCrateVersionPattern =
  /(\[\[package\]\]\nname = "sendmock(?:-[a-z]+)?"\nversion = ")([^"]+)(")/g;

export type VersionedFileReading = { filePath: string; version: string | null };

export function readWorkspaceVersion(cargoToml: string): string | null {
  return cargoToml.match(workspaceVersionPattern)?.[2] ?? null;
}

export function writeWorkspaceVersion(cargoToml: string, version: string) {
  return cargoToml.replace(workspaceVersionPattern, `$1${version}$3`);
}

export function readLockedCrateVersions(cargoLock: string): string[] {
  return [...cargoLock.matchAll(workspaceCrateVersionPattern)].map(
    (crateMatch) => crateMatch[2] ?? "",
  );
}

export function writeLockedCrateVersions(cargoLock: string, version: string) {
  return cargoLock.replace(workspaceCrateVersionPattern, `$1${version}$3`);
}

/** Sets `"version"` as the second key, after `"name"`, where npm puts it. */
export function writePackageVersion(packageJson: string, version: string) {
  const packageManifest = JSON.parse(packageJson) as Record<string, unknown>;
  const { name, ...otherFields } = packageManifest;
  const { version: _previousVersion, ...fieldsWithoutVersion } = otherFields;
  return `${JSON.stringify({ name, version, ...fieldsWithoutVersion }, null, 2)}\n`;
}

export function readAllVersions(
  repositoryRoot: string,
): VersionedFileReading[] {
  const readText = (filePath: string) =>
    readFileSync(join(repositoryRoot, filePath), "utf8");
  return [
    {
      filePath: workspaceManifestPath,
      version: readWorkspaceVersion(readText(workspaceManifestPath)),
    },
    ...readLockedCrateVersions(readText(cargoLockPath)).map((version) => ({
      filePath: cargoLockPath,
      version,
    })),
    ...packageManifestPaths.map((filePath) => ({
      filePath,
      version:
        (JSON.parse(readText(filePath)) as { version?: string }).version ??
        null,
    })),
  ];
}

/** Files whose version differs from the workspace Cargo.toml. */
export function findDisagreeingFiles(readings: VersionedFileReading[]) {
  const sourceVersion = readings[0]?.version ?? null;
  return readings.filter((reading) => reading.version !== sourceVersion);
}

export function writeAllVersions(repositoryRoot: string, version: string) {
  const rewrite = (filePath: string, change: (text: string) => string) => {
    const absolutePath = join(repositoryRoot, filePath);
    writeFileSync(absolutePath, change(readFileSync(absolutePath, "utf8")));
  };
  rewrite(workspaceManifestPath, (text) =>
    writeWorkspaceVersion(text, version),
  );
  rewrite(cargoLockPath, (text) => writeLockedCrateVersions(text, version));
  for (const filePath of packageManifestPaths) {
    rewrite(filePath, (text) => writePackageVersion(text, version));
  }
}
