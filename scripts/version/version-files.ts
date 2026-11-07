import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Every file that carries the version; the workspace Cargo.toml is the source of truth. */
export const workspaceManifestPath = "Cargo.toml";
const cargoLockPath = "Cargo.lock";
const packageManifestPaths = [
  "web/package.json",
  "website/package.json",
  "testcontainers/node/package.json",
  "plugin/.claude-plugin/plugin.json",
];

/** The version line in the plugin's copy of the skill, as `sendmock ai skill` renders it. */
export const pluginSkillVersionPattern = /(Written for SendMock )(\S+?)(\. )/;

/**
 * Other files that carry the version, each with the pattern around it: the plugin's copy of
 * the skill, the MCP registry's `server.json` (the server, its npm package and its image tag),
 * the Testcontainers modules' versions and their default image tags, which name the SendMock
 * they were released with (Go's version is its tag), and the Helm chart's version and appVersion.
 */
const textVersionFiles = [
  {
    filePath: "plugin/skills/sendmock/SKILL.md",
    pattern: pluginSkillVersionPattern,
  },
  { filePath: "packaging/helm/sendmock/Chart.yaml", pattern: /(\nversion: )(\S+)(\n)/ },
  {
    filePath: "packaging/helm/sendmock/Chart.yaml",
    pattern: /(\nappVersion: ")([^"]+)(")/,
  },
  { filePath: "server.json", pattern: /(\n  "version": ")([^"]+)(")/ },
  { filePath: "server.json", pattern: /(\n {6}"version": ")([^"]+)(")/ },
  {
    filePath: "server.json",
    pattern: /(ghcr\.io\/shibbirweb\/sendmock:)([^"]+)(")/,
  },
  {
    filePath: "testcontainers/python/pyproject.toml",
    pattern: /(\[project\][^[]*?\nversion = ")([^"]+)(")/,
  },
  {
    filePath: "testcontainers/java/pom.xml",
    pattern:
      /(<artifactId>sendmock-testcontainers<\/artifactId>\s*<version>)([^<]+)(<\/version>)/,
  },
  {
    filePath:
      "testcontainers/dotnet/SendMock.Testcontainers/SendMock.Testcontainers.csproj",
    pattern: /(<Version>)([^<]+)(<\/Version>)/,
  },
  ...[
    "testcontainers/node/src/sendmock-container.ts",
    "testcontainers/python/sendmock_testcontainers/__init__.py",
    "testcontainers/java/src/main/java/io/github/shibbirweb/sendmock/SendMockContainer.java",
    "testcontainers/go/sendmock.go",
    "testcontainers/dotnet/SendMock.Testcontainers/SendMockContainer.cs",
  ].map((filePath) => ({
    filePath,
    pattern: /(ghcr\.io\/shibbirweb\/sendmock:)([^"]+)(")/,
  })),
];

export function readTextVersion(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[2] ?? null;
}

export function writeTextVersion(
  text: string,
  pattern: RegExp,
  version: string,
): string {
  return text.replace(pattern, `$1${version}$3`);
}

const workspaceVersionPattern =
  /(\[workspace\.package\][^[]*?\nversion = ")([^"]+)(")/;
const internalDependencyVersionPattern =
  /(\nsendmock(?:-[a-z]+)? = \{ path = "crates\/[a-z-]+", version = "=)([^"]+)(")/g;
const workspaceCrateVersionPattern =
  /(\[\[package\]\]\nname = "sendmock(?:-[a-z]+)?"\nversion = ")([^"]+)(")/g;

export type VersionedFileReading = { filePath: string; version: string | null };

export function readWorkspaceVersion(cargoToml: string): string | null {
  return cargoToml.match(workspaceVersionPattern)?.[2] ?? null;
}

export function writeWorkspaceVersion(cargoToml: string, version: string) {
  return cargoToml
    .replace(workspaceVersionPattern, `$1${version}$3`)
    .replace(internalDependencyVersionPattern, `$1${version}$3`);
}

/** The exact versions the workspace pins its own crates to (`version = "=X.Y.Z"`). */
export function readInternalDependencyVersions(cargoToml: string): string[] {
  return [...cargoToml.matchAll(internalDependencyVersionPattern)].map(
    (dependencyMatch) => dependencyMatch[2] ?? "",
  );
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
    ...readInternalDependencyVersions(readText(workspaceManifestPath)).map(
      (version) => ({ filePath: workspaceManifestPath, version }),
    ),
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
    ...textVersionFiles.map(({ filePath, pattern }) => ({
      filePath,
      version: readTextVersion(readText(filePath), pattern),
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
  for (const { filePath, pattern } of textVersionFiles) {
    rewrite(filePath, (text) => writeTextVersion(text, pattern, version));
  }
}
