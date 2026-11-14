import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const installScriptPath = join(import.meta.dir, "install.sh");

type InstallResult = { exitCode: number; output: string };

let sandboxDirectory = "";
let releasesDirectory = "";
let homeDirectory = "";

function readTargetTriple(): string {
  const operatingSystem = Bun.spawnSync(["uname", "-s"])
    .stdout.toString()
    .trim();
  const cpu = Bun.spawnSync(["uname", "-m"]).stdout.toString().trim();
  const cpuPart = cpu === "arm64" || cpu === "aarch64" ? "aarch64" : "x86_64";
  const osPart =
    operatingSystem === "Darwin" ? "apple-darwin" : "unknown-linux-musl";
  return `${cpuPart}-${osPart}`;
}

function computeSha256(filePath: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(readFileSync(filePath));
  return hasher.digest("hex");
}

/** A release folder holding an archive whose `sendmock` prints the given version line. */
function writeFakeRelease(
  releaseFolder: string,
  versionLine: string,
  shouldCorruptChecksum = false,
) {
  const downloadDirectory = join(releasesDirectory, releaseFolder);
  const contentDirectory = join(sandboxDirectory, `content-${versionLine}`);
  mkdirSync(downloadDirectory, { recursive: true });
  mkdirSync(contentDirectory, { recursive: true });
  const fakeBinaryPath = join(contentDirectory, "sendmock");
  writeFileSync(fakeBinaryPath, `#!/bin/sh\necho "${versionLine}"\n`);
  chmodSync(fakeBinaryPath, 0o755);
  const archiveName = `sendmock-${readTargetTriple()}.tar.gz`;
  const archivePath = join(downloadDirectory, archiveName);
  Bun.spawnSync([
    "tar",
    "-czf",
    archivePath,
    "-C",
    contentDirectory,
    "sendmock",
  ]);
  const checksum = shouldCorruptChecksum
    ? "0".repeat(64)
    : computeSha256(archivePath);
  writeFileSync(
    join(downloadDirectory, "SHA256SUMS"),
    `${"1".repeat(64)}  sendmock-other.zip\n${checksum}  ${archiveName}\n`,
  );
}

function runInstallScript(
  scriptArguments: string[],
  environment: Record<string, string> = {},
): InstallResult {
  const installResult = Bun.spawnSync(
    ["sh", installScriptPath, ...scriptArguments],
    {
      env: {
        HOME: homeDirectory,
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        SHELL: "/bin/bash",
        SENDMOCK_RELEASES_URL: `file://${releasesDirectory}`,
        ...environment,
      },
    },
  );
  return {
    exitCode: installResult.exitCode,
    output: installResult.stdout.toString() + installResult.stderr.toString(),
  };
}

function readInstalledVersion(): string {
  const installedBinaryPath = join(homeDirectory, ".local/bin/sendmock");
  return Bun.spawnSync([installedBinaryPath]).stdout.toString().trim();
}

beforeEach(() => {
  sandboxDirectory = mkdtempSync(join(tmpdir(), "sendmock-install-test-"));
  releasesDirectory = join(sandboxDirectory, "releases");
  homeDirectory = join(sandboxDirectory, "home");
  mkdirSync(homeDirectory, { recursive: true });
  writeFakeRelease("latest/download", "sendmock 1.0.0 (stable)");
  writeFakeRelease("download/beta", "sendmock 1.1.0-beta.1 (beta)");
});

afterEach(() => {
  rmSync(sandboxDirectory, { recursive: true, force: true });
});

describe("install.sh", () => {
  test("DS-03.2 installs the stable by default into ~/.local/bin", () => {
    const installResult = runInstallScript([]);

    expect(installResult.exitCode).toBe(0);
    expect(readInstalledVersion()).toBe("sendmock 1.0.0 (stable)");
  });

  test("DS-03.2 installs the beta with --channel beta", () => {
    const installResult = runInstallScript(["--channel", "beta"]);

    expect(installResult.exitCode).toBe(0);
    expect(readInstalledVersion()).toBe("sendmock 1.1.0-beta.1 (beta)");
  });

  test("DS-03.2 takes the channel from SENDMOCK_CHANNEL", () => {
    const installResult = runInstallScript([], { SENDMOCK_CHANNEL: "beta" });

    expect(installResult.exitCode).toBe(0);
    expect(readInstalledVersion()).toBe("sendmock 1.1.0-beta.1 (beta)");
  });

  test("DS-03.2 a checksum that does not match stops it with nothing installed", () => {
    writeFakeRelease("latest/download", "sendmock 1.0.0 (stable)", true);

    const installResult = runInstallScript([]);

    expect(installResult.exitCode).toBe(1);
    expect(installResult.output).toContain("does not match SHA256SUMS");
    expect(existsSync(join(homeDirectory, ".local/bin/sendmock"))).toBe(false);
  });

  test("refuses an unknown channel", () => {
    const installResult = runInstallScript(["--channel", "nightly"]);

    expect(installResult.exitCode).toBe(1);
    expect(installResult.output).toContain("unknown channel 'nightly'");
  });

  test("refuses an unknown option and shows the usage", () => {
    const installResult = runInstallScript(["--force"]);

    expect(installResult.exitCode).toBe(1);
    expect(installResult.output).toContain("Usage: install.sh");
  });

  test("DS-01.5 adds the install folder to the shell profile once", () => {
    runInstallScript([]);
    runInstallScript([]);

    const profileText = readFileSync(join(homeDirectory, ".bashrc"), "utf8");
    const pathLines = profileText
      .split("\n")
      .filter((profileLine) => profileLine.includes("export PATH="));
    expect(pathLines).toEqual([
      `export PATH="${join(homeDirectory, ".local/bin")}:$PATH"`,
    ]);
  });

  test("DS-01.5 a new login shell finds sendmock on the PATH", () => {
    runInstallScript([]);

    const newShellResult = Bun.spawnSync(
      ["bash", "-c", `. "${join(homeDirectory, ".bashrc")}" && sendmock`],
      { env: { HOME: homeDirectory, PATH: "/usr/bin:/bin" } },
    );
    expect(newShellResult.stdout.toString().trim()).toBe(
      "sendmock 1.0.0 (stable)",
    );
  });

  test("writes the zsh profile for zsh users", () => {
    runInstallScript([], { SHELL: "/bin/zsh" });

    expect(readFileSync(join(homeDirectory, ".zshrc"), "utf8")).toContain(
      "# Added by the SendMock installer",
    );
  });

  test("leaves the profile alone with --no-modify-path", () => {
    const installResult = runInstallScript(["--no-modify-path"]);

    expect(installResult.exitCode).toBe(0);
    expect(existsSync(join(homeDirectory, ".bashrc"))).toBe(false);
    expect(installResult.output).toContain("to your PATH to run sendmock");
  });

  test("leaves the profile alone when the folder is already on PATH", () => {
    const installDirectory = join(homeDirectory, ".local/bin");
    runInstallScript([], { PATH: `${installDirectory}:/usr/bin:/bin` });

    expect(existsSync(join(homeDirectory, ".bashrc"))).toBe(false);
  });

  test("installs into --install-dir", () => {
    const customDirectory = join(sandboxDirectory, "tools");

    const installResult = runInstallScript(["--install-dir", customDirectory]);

    expect(installResult.exitCode).toBe(0);
    expect(existsSync(join(customDirectory, "sendmock"))).toBe(true);
  });
});
