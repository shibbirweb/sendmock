import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  findDisagreeingFiles,
  readAllVersions,
  readInternalDependencyVersions,
  readLockedCrateVersions,
  readWorkspaceVersion,
  writeLockedCrateVersions,
  writePackageVersion,
  writeWorkspaceVersion,
} from "./version-files";

const cargoToml =
  '[workspace]\nmembers = ["crates/*"]\n\n[workspace.package]\n# the source of truth\nversion = "0.3.1"\nedition = "2024"\n';
const cargoLock =
  '[[package]]\nname = "sendmock"\nversion = "0.3.1"\n\n[[package]]\nname = "sendmock-api"\nversion = "0.3.1"\n\n[[package]]\nname = "serde"\nversion = "1.0.0"\n';

describe("version files (DS-05.1)", () => {
  test("DS-05.1 writes the version into Cargo.toml, the workspace crates in Cargo.lock and package.json", () => {
    expect(
      readWorkspaceVersion(writeWorkspaceVersion(cargoToml, "0.4.0-beta.1")),
    ).toBe("0.4.0-beta.1");
    const lockedVersions = readLockedCrateVersions(
      writeLockedCrateVersions(cargoLock, "0.4.0-beta.1"),
    );
    expect(lockedVersions).toEqual(["0.4.0-beta.1", "0.4.0-beta.1"]);
    expect(writeLockedCrateVersions(cargoLock, "0.4.0-beta.1")).toContain(
      'name = "serde"\nversion = "1.0.0"',
    );
    expect(
      JSON.parse(
        writePackageVersion(
          '{"name":"sendmock-web","private":true}',
          "0.4.0-beta.1",
        ),
      ),
    ).toEqual({
      name: "sendmock-web",
      version: "0.4.0-beta.1",
      private: true,
    });
  });

  test("DS-05.1 writes the exact version the workspace pins its own crates to", () => {
    const workspaceWithCrates = `${cargoToml}\n[workspace.dependencies]\nsendmock-api = { path = "crates/sendmock-api", version = "=0.3.1" }\nsendmock-core = { path = "crates/sendmock-core", version = "=0.3.1" }\nserde = { version = "1" }\n`;

    const rewritten = writeWorkspaceVersion(workspaceWithCrates, "1.0.0");

    expect(readInternalDependencyVersions(rewritten)).toEqual([
      "1.0.0",
      "1.0.0",
    ]);
    expect(rewritten).toContain('serde = { version = "1" }');
  });

  test("DS-05.1 writes the version of a crate whose name has a digit, such as sendmock-pop3", () => {
    const workspaceWithCrates = `${cargoToml}\n[workspace.dependencies]\nsendmock-pop3 = { path = "crates/sendmock-pop3", version = "=0.3.1" }\n`;
    const lockWithDigitCrate = `${cargoLock}\n[[package]]\nname = "sendmock-pop3"\nversion = "0.3.1"\n`;

    expect(
      readInternalDependencyVersions(
        writeWorkspaceVersion(workspaceWithCrates, "1.0.0"),
      ),
    ).toEqual(["1.0.0"]);
    expect(
      readLockedCrateVersions(
        writeLockedCrateVersions(lockWithDigitCrate, "1.0.0"),
      ),
    ).toEqual(["1.0.0", "1.0.0", "1.0.0"]);
  });

  test("DS-05.1 every internal crate of this repository is found in Cargo.toml and Cargo.lock", () => {
    const repositoryRoot = join(import.meta.dir, "../..");
    const workspaceManifest = readFileSync(
      join(repositoryRoot, "Cargo.toml"),
      "utf8",
    );
    const workspaceLock = readFileSync(
      join(repositoryRoot, "Cargo.lock"),
      "utf8",
    );
    const internalDependencyCount = (
      workspaceManifest.match(/\nsendmock[^ ]* = \{ path = "crates\//g) ?? []
    ).length;
    const lockedCrateCount = (
      workspaceLock.match(
        /\[\[package\]\]\nname = "sendmock[^"]*"\nversion = "[^"]+"\nsource/g,
      ) ?? []
    ).length;
    const workspaceCrateCount =
      (workspaceLock.match(/\[\[package\]\]\nname = "sendmock[^"]*"\n/g) ?? [])
        .length - lockedCrateCount;

    expect(readInternalDependencyVersions(workspaceManifest)).toHaveLength(
      internalDependencyCount,
    );
    expect(readLockedCrateVersions(workspaceLock)).toHaveLength(
      workspaceCrateCount,
    );
  });

  test("DS-05.2 names the files that disagree with Cargo.toml", () => {
    const disagreeingFiles = findDisagreeingFiles([
      { filePath: "Cargo.toml", version: "0.3.1" },
      { filePath: "Cargo.lock", version: "0.3.1" },
      { filePath: "web/package.json", version: "0.3.0" },
      { filePath: "website/package.json", version: null },
    ]);

    expect(disagreeingFiles.map((file) => file.filePath)).toEqual([
      "web/package.json",
      "website/package.json",
    ]);
  });

  test("DS-05.2 every file in this repository carries the same version", () => {
    expect(
      findDisagreeingFiles(readAllVersions(join(import.meta.dir, "../.."))),
    ).toEqual([]);
  });
});
