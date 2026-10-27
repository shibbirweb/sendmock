import type { ManualDownload } from "./manual-download-links";

export const sendmockReleasesUrl =
  "https://github.com/shibbirweb/sendmock/releases";

/** The install scripts come from the latest GitHub release (docs/plan/10-open-questions.md, 13). */
const latestReleaseDownloadUrl = `${sendmockReleasesUrl}/latest/download`;

export type InstallPlatform = {
  key: string;
  label: string;
  prompt: string;
  installCommand: string;
  installedMessage: string;
  runCommand: string;
  /** Docker publishes the ports, so the server binds every interface there. */
  listenHost: string;
  downloads: ManualDownload[];
};

/** The native installs all leave one `sendmock` binary on the PATH. */
const binaryPlatformRun = {
  installedMessage: "✔ Installed sendmock (one 12 MB binary)",
  runCommand: "sendmock",
  listenHost: "127.0.0.1",
};

/**
 * One install command per platform, then the command that starts the server.
 * Archive names follow docs/plan/09-distribution.md (Release archives).
 */
export const installPlatforms: InstallPlatform[] = [
  {
    key: "macos",
    label: "macOS",
    prompt: "$",
    installCommand: "brew install shibbirweb/tap/sendmock",
    ...binaryPlatformRun,
    downloads: [
      {
        architectureLabel: "Apple silicon",
        archiveFileName: "sendmock-aarch64-apple-darwin.tar.gz",
      },
      {
        architectureLabel: "Intel",
        archiveFileName: "sendmock-x86_64-apple-darwin.tar.gz",
      },
    ],
  },
  {
    key: "windows",
    label: "Windows",
    prompt: "PS>",
    installCommand: `irm ${latestReleaseDownloadUrl}/install.ps1 | iex`,
    ...binaryPlatformRun,
    downloads: [
      {
        architectureLabel: "x64",
        archiveFileName: "sendmock-x86_64-pc-windows-msvc.zip",
      },
      {
        architectureLabel: "Arm64",
        archiveFileName: "sendmock-aarch64-pc-windows-msvc.zip",
      },
    ],
  },
  {
    key: "linux",
    label: "Linux",
    prompt: "$",
    installCommand: `curl -fsSL ${latestReleaseDownloadUrl}/install.sh | sh`,
    ...binaryPlatformRun,
    downloads: [
      {
        architectureLabel: "x64",
        archiveFileName: "sendmock-x86_64-unknown-linux-musl.tar.gz",
      },
      {
        architectureLabel: "Arm64",
        archiveFileName: "sendmock-aarch64-unknown-linux-musl.tar.gz",
      },
    ],
  },
  {
    key: "docker",
    label: "Docker",
    prompt: "$",
    installCommand: "docker pull ghcr.io/shibbirweb/sendmock",
    installedMessage: "✔ Pulled ghcr.io/shibbirweb/sendmock:latest",
    runCommand:
      "docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock",
    listenHost: "0.0.0.0",
    downloads: [],
  },
];
