import type { DownloadNote, ManualDownload } from "./manual-download-links";
import type { PlatformRequirement } from "./platform-requirement-note";

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
  /** Null when the install command also starts the server, as `npx sendmock` does. */
  runCommand: string | null;
  /** Docker publishes the ports, so the server binds every interface there. */
  listenHost: string;
  downloads: ManualDownload[];
  /** Shown under the downloads; macOS and Windows need one while their builds are not signed. */
  downloadNote: DownloadNote | null;
  /** What the runner needs on the computer first (Node.js for npx, Bun for bunx), or null. */
  requirement: PlatformRequirement | null;
};

/** The native installs all leave one `sendmock` binary on the PATH. */
const binaryPlatformRun = {
  installedMessage: "✔ Installed sendmock (one 12 MB binary)",
  runCommand: "sendmock",
  listenHost: "127.0.0.1",
};

/**
 * One install command per platform, then the command that starts the server. The runners that
 * need no install lead, and npx is the tab every visitor sees first. Archive names follow
 * docs/plan/09-distribution.md (Release archives).
 */
export const installPlatforms: InstallPlatform[] = [
  {
    key: "npx",
    label: "npx",
    prompt: "$",
    installCommand: "npx sendmock",
    installedMessage: "✔ Fetched into npm's cache, no install",
    runCommand: null,
    listenHost: "127.0.0.1",
    downloads: [],
    requirement: {
      name: "Node.js 18 or newer",
      url: "https://nodejs.org/en/download",
    },
    downloadNote: null,
  },
  {
    key: "bunx",
    label: "bunx",
    prompt: "$",
    installCommand: "bunx sendmock",
    installedMessage: "✔ Fetched into Bun's cache, no install",
    runCommand: null,
    listenHost: "127.0.0.1",
    downloads: [],
    requirement: { name: "Bun", url: "https://bun.sh/docs/installation" },
    downloadNote: null,
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
    requirement: null,
    downloadNote: null,
  },
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
    requirement: null,
    downloadNote: {
      text: "Downloaded with a browser? macOS asks once before it runs an unsigned binary.",
      linkLabel: "How to allow it",
      docsPath: "/docs/troubleshooting#macos-says-it-could-not-verify-sendmock",
    },
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
    requirement: null,
    downloadNote: {
      text: "Downloaded with a browser? Windows may ask once before it runs an unsigned program.",
      linkLabel: "How to allow it",
      docsPath: "/docs/troubleshooting#windows-protected-your-pc",
    },
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
    requirement: null,
    downloadNote: null,
  },
];
