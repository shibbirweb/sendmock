import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildLauncherPackageJson,
  buildPlatformPackageJson,
  npmPlatforms,
  writeNpmPackages,
} from "./npm-packages";

const {
  buildBinaryEnvironment,
  findPlatformPackage,
  locateBinary,
  platformPackages,
} = require("../../packaging/npm/sendmock/lib/launcher.js") as {
  buildBinaryEnvironment: (
    parentEnvironment: Record<string, string>,
  ) => Record<string, string>;
  findPlatformPackage: (platform: string, cpu: string) => string | null;
  locateBinary: (
    platform: string,
    cpu: string,
    resolvePackageJson: (request: string) => string,
  ) => { binaryPath?: string; errorMessage?: string };
  platformPackages: Record<string, string>;
};

describe("npm packages", () => {
  test("DS-03.1 sendmock lists a platform package for every target at the same version", () => {
    const launcherPackageJson = buildLauncherPackageJson("1.2.0");

    expect(launcherPackageJson.bin).toEqual({ sendmock: "bin/sendmock.js" });
    expect(launcherPackageJson.optionalDependencies).toEqual({
      "@sendmock/darwin-arm64": "1.2.0",
      "@sendmock/darwin-x64": "1.2.0",
      "@sendmock/linux-arm64": "1.2.0",
      "@sendmock/linux-x64": "1.2.0",
      "@sendmock/win32-arm64": "1.2.0",
      "@sendmock/win32-x64": "1.2.0",
    });
    expect(launcherPackageJson.mcpName).toBe("io.github.shibbirweb/sendmock");
  });

  test("DS-03.1 each platform package holds one binary and installs only on its system", () => {
    const windowsPlatform = npmPlatforms.find(
      (npmPlatform) => npmPlatform.platformKey === "win32-arm64",
    );
    if (windowsPlatform === undefined) {
      throw new Error("no win32-arm64 platform");
    }

    expect(buildPlatformPackageJson("1.2.0", windowsPlatform)).toMatchObject({
      name: "@sendmock/win32-arm64",
      os: ["win32"],
      cpu: ["arm64"],
      files: ["sendmock.exe"],
    });
  });

  test("the launcher and the release packages name the same platform packages", () => {
    expect(Object.values(platformPackages).sort()).toEqual(
      Object.keys(
        buildLauncherPackageJson("1.2.0").optionalDependencies,
      ).sort(),
    );
  });

  test("writes the launcher and one platform's package from its archive", () => {
    const workDirectory = mkdtempSync(join(tmpdir(), "sendmock-npm-test-"));
    const archivesDirectory = join(workDirectory, "archives");
    const contentDirectory = join(workDirectory, "content");
    mkdirSync(archivesDirectory);
    mkdirSync(contentDirectory);
    writeFileSync(join(contentDirectory, "sendmock"), "binary");
    Bun.spawnSync([
      "tar",
      "-czf",
      join(archivesDirectory, "sendmock-x86_64-unknown-linux-musl.tar.gz"),
      "-C",
      contentDirectory,
      "sendmock",
    ]);

    writeNpmPackages(
      "1.2.0",
      archivesDirectory,
      join(workDirectory, "out"),
      "x86_64-unknown-linux-musl",
    );

    const outputDirectory = join(workDirectory, "out");
    expect(
      readFileSync(join(outputDirectory, "linux-x64/sendmock"), "utf8"),
    ).toBe("binary");
    expect(existsSync(join(outputDirectory, "sendmock/bin/sendmock.js"))).toBe(
      true,
    );
    expect(
      JSON.parse(
        readFileSync(join(outputDirectory, "sendmock/package.json"), "utf8"),
      ).version,
    ).toBe("1.2.0");
    expect(existsSync(join(outputDirectory, "darwin-arm64"))).toBe(false);
  });
});

describe("npm launcher", () => {
  test("DS-03.1 finds the platform package's binary", () => {
    const located = locateBinary(
      "win32",
      "x64",
      (request) => `/project/node_modules/${request}`,
    );

    expect(located.binaryPath).toBe(
      join("/project/node_modules/@sendmock/win32-x64", "sendmock.exe"),
    );
  });

  test("says which package is missing when optional packages were skipped", () => {
    const located = locateBinary("linux", "arm64", () => {
      throw new Error("Cannot find module");
    });

    expect(located.errorMessage).toContain(
      "@sendmock/linux-arm64 package is missing",
    );
  });

  test("names the builds that exist for an unsupported system", () => {
    expect(findPlatformPackage("freebsd", "x64")).toBeNull();
    expect(locateBinary("freebsd", "x64", () => "").errorMessage).toContain(
      "no build for freebsd on x64",
    );
  });

  test("AI-05.9 tells the binary that npm started it and keeps the rest of the environment", () => {
    expect(buildBinaryEnvironment({ PATH: "/usr/bin" })).toEqual({
      PATH: "/usr/bin",
      SENDMOCK_LAUNCHER: "npm",
    });
  });
});
