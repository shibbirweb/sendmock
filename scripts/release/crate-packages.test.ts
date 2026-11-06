import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type CrateManifest = {
  package: {
    name: string;
    description?: string;
    publish?: boolean;
    include?: string[];
  };
};
type WorkspaceManifest = {
  workspace: {
    dependencies: Record<string, { path?: string; version?: string }>;
  };
};

const crateNames = readdirSync("crates");
const readCrateManifest = (crateName: string) =>
  Bun.TOML.parse(
    readFileSync(join("crates", crateName, "Cargo.toml"), "utf8"),
  ) as CrateManifest;

describe("crates.io packages", () => {
  test("DS-03.1 every crate can be published and says what it is", () => {
    for (const crateName of crateNames) {
      const crateManifest = readCrateManifest(crateName);
      expect(crateManifest.package.publish).toBeUndefined();
      expect(crateManifest.package.description?.length ?? 0).toBeGreaterThan(
        10,
      );
    }
  });

  test("DS-03.1 the library crates carry the exact workspace version beside their path", () => {
    const workspaceManifest = Bun.TOML.parse(
      readFileSync("Cargo.toml", "utf8"),
    ) as WorkspaceManifest;
    const internalDependencies = Object.entries(
      workspaceManifest.workspace.dependencies,
    ).filter(([, dependency]) => dependency.path !== undefined);

    expect(
      internalDependencies.map(([dependencyName]) => dependencyName).sort(),
    ).toEqual(
      crateNames.filter((crateName) => crateName !== "sendmock").sort(),
    );
    for (const [, dependency] of internalDependencies) {
      expect(dependency.version).toMatch(/^=\d+\.\d+\.\d+/);
    }
  });

  test("DS-03.1 the crates that embed files from outside their folder package the staged copies", () => {
    const gitignoreText = readFileSync(".gitignore", "utf8");
    const stagingScript = readFileSync(
      "scripts/release/stage-crate-files.sh",
      "utf8",
    );

    for (const [crateName, stagedFolder] of [
      ["sendmock-api", "web-dist"],
      ["sendmock-ops", "skill"],
    ] as const) {
      expect(readCrateManifest(crateName).package.include).toContain(
        `${stagedFolder}/**/*`,
      );
      expect(gitignoreText).toContain(`/crates/${crateName}/${stagedFolder}/`);
      expect(stagingScript).toContain(`crates/${crateName}/${stagedFolder}`);
    }
  });
});
