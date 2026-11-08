import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type WorkflowStep = { name?: string; run?: string; if?: string };
type TrayWorkflow = {
  jobs: {
    tray: { strategy: { matrix: { os: string[] } }; steps: WorkflowStep[] };
  };
};

const workflow = Bun.YAML.parse(
  readFileSync(".github/workflows/tray-app.yml", "utf8"),
) as TrayWorkflow;
const trayJob = workflow.jobs.tray;
const trayManifest = readFileSync("crates/sendmock-tray/Cargo.toml", "utf8");
const sendmockManifest = readFileSync("crates/sendmock/Cargo.toml", "utf8");

describe("Tray app workflow", () => {
  test("DS-08.4 the tray app is built, linted and tested with its GUI on Linux, macOS and Windows", () => {
    const runCommands = trayJob.steps.map((step) => step.run ?? "").join("\n");

    expect(trayJob.strategy.matrix.os).toEqual([
      "ubuntu-26.04",
      "macos-latest",
      "windows-latest",
    ]);
    expect(runCommands).toContain("cargo clippy -p sendmock-tray --all-targets --features gui");
    expect(runCommands).toContain("cargo test -p sendmock-tray --features gui");
    expect(runCommands).toContain("cargo build -p sendmock-tray --features gui --release");
    expect(runCommands).toContain("libayatana-appindicator3-dev");
  });

  test("DS-08.4 the GUI crates stay behind the tray's gui feature and out of sendmock", () => {
    expect(trayManifest).toContain('required-features = [\n    "gui",\n]');
    expect(trayManifest).toContain("tray-icon = { version");
    expect(trayManifest).toContain("optional = true");
    expect(sendmockManifest).not.toContain("tray-icon");
    expect(sendmockManifest).not.toContain("sendmock-tray");
    const runCommands = trayJob.steps.map((step) => step.run ?? "").join("\n");
    expect(runCommands).toContain("cargo tree -p sendmock -e normal");
  });

  test("DS-08.5 the Install page says how to install and run the tray app on each OS", () => {
    const installPage = readFileSync("docs/wiki/install.md", "utf8");
    const traySection = installPage.slice(installPage.indexOf("## Menu bar and tray app"));

    expect(traySection).toContain("cargo install sendmock-tray --features gui --locked");
    expect(traySection).toContain("libayatana-appindicator3-dev");
    expect(traySection).toContain("macOS menu bar");
    expect(traySection).toContain("Windows and Linux system tray");
  });
});
