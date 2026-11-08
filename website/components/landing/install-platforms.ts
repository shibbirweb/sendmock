import type { InstallDocsLink } from "./install-docs-links";
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
  /** The other ways to install for this tab, each with its full steps in the docs. */
  docsLinks: InstallDocsLink[];
};

/** The native installs all leave one `sendmock` binary on the PATH. */
const binaryPlatformRun = {
  installedMessage: "✔ Installed sendmock (one binary, under 20 MB)",
  runCommand: "sendmock",
  listenHost: "127.0.0.1",
};

/**
 * One install command per platform, then the command that starts the server. The runners that
 * need no install lead; a visitor whose system is known sees that system's tab first instead
 * (`orderInstallPlatforms`). Archive names follow docs/plan/09-distribution.md (Release archives).
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
    docsLinks: [
      { label: "Full npx steps", docsPath: "/docs/install#npx-no-install" },
    ],
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
    docsLinks: [
      { label: "Full bunx steps", docsPath: "/docs/install#bunx-no-install" },
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
    requirement: null,
    downloadNote: null,
    docsLinks: [
      { label: "Docker Compose", docsPath: "/docs/install#docker-compose" },
      { label: "Kubernetes (Helm)", docsPath: "/docs/connect/kubernetes" },
      {
        label: "Docker Desktop extension",
        docsPath: "/docs/install#docker-desktop-extension",
      },
      { label: "Docker guide", docsPath: "/docs/connect/docker" },
    ],
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
    docsLinks: [
      { label: "Homebrew", docsPath: "/docs/install#homebrew-macos-and-linux" },
      {
        label: "Install script",
        docsPath: "/docs/install#install-script-linux-and-macos",
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
    requirement: null,
    downloadNote: {
      text: "Downloaded with a browser? Windows may ask once before it runs an unsigned program.",
      linkLabel: "How to allow it",
      docsPath: "/docs/troubleshooting#windows-protected-your-pc",
    },
    docsLinks: [
      { label: "Scoop", docsPath: "/docs/install#scoop-windows" },
      { label: "WinGet", docsPath: "/docs/install#winget-windows" },
      { label: "Chocolatey", docsPath: "/docs/install#chocolatey-windows" },
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
    requirement: null,
    downloadNote: null,
    docsLinks: [
      { label: "apt", docsPath: "/docs/install#apt-debian-and-ubuntu" },
      { label: "dnf", docsPath: "/docs/install#dnf-fedora-rhel-and-similar" },
      { label: "Nix", docsPath: "/docs/install#nix" },
      { label: "Homebrew", docsPath: "/docs/install#homebrew-macos-and-linux" },
    ],
  },
];

/**
 * The tabs for one visitor: their own system first when it is known, since its install
 * command is the one they are most likely to run, then the rest in the order above.
 */
export function orderInstallPlatforms(
  platforms: InstallPlatform[],
  visitorPlatformKey: string | null,
): InstallPlatform[] {
  const visitorPlatform = platforms.find(
    (installPlatform) => installPlatform.key === visitorPlatformKey,
  );
  if (visitorPlatform === undefined) {
    return platforms;
  }
  return [
    visitorPlatform,
    ...platforms.filter(
      (installPlatform) => installPlatform !== visitorPlatform,
    ),
  ];
}
