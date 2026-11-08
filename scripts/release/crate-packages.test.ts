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

const applicationCrateNames = ["sendmock", "sendmock-tray"];

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
      // The applications (the binary and the tray app) are what nothing depends on.
      crateNames
        .filter((crateName) => !applicationCrateNames.includes(crateName))
        .sort(),
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

  test("DS-03.1 a cargo install build reports the channel it was published on, not dev", () => {
    const stagingScript = readFileSync(
      "scripts/release/stage-crate-files.sh",
      "utf8",
    );
    const buildScript = readFileSync("crates/sendmock/build.rs", "utf8");

    expect(readCrateManifest("sendmock").package.include).toContain(
      "release-channel",
    );
    expect(stagingScript).toContain('release_channel="${1:-stable}"');
    expect(stagingScript).toContain("crates/sendmock/release-channel");
    expect(buildScript).toContain(
      "cargo::rustc-env=SENDMOCK_RELEASE_CHANNEL=",
    );
    expect(readFileSync(".gitignore", "utf8")).toContain(
      "/crates/sendmock/release-channel",
    );
  });
});
