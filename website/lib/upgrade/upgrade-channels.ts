/**
 * How to move to a newer SendMock on each way it can be installed, the same
 * channels as the Install page. Each step is one command, run in order.
 */

export type UpgradeStep = {
  description: string;
  stableCommand: string;
  /** Only when the beta channel needs another command. */
  betaCommand?: string;
};

export type UpgradeChannel = {
  name: string;
  /** The Install page's section for this channel. */
  installAnchor: string;
  steps: UpgradeStep[];
};

export const upgradeChannels: UpgradeChannel[] = [
  {
    name: "npx and bunx",
    installAnchor: "npx-no-install",
    steps: [
      {
        description:
          "Ask for the newest release by its tag; a plain `npx sendmock` can reuse the copy in the cache.",
        stableCommand: "npx sendmock@latest",
        betaCommand: "npx sendmock@beta",
      },
    ],
  },
  {
    name: "Homebrew",
    installAnchor: "homebrew-macos-and-linux",
    steps: [
      {
        description: "Fetch the newest formulas.",
        stableCommand: "brew update",
      },
      {
        description: "Upgrade SendMock.",
        stableCommand: "brew upgrade shibbirweb/tap/sendmock",
        betaCommand: "brew upgrade shibbirweb/tap/sendmock-beta",
      },
    ],
  },
  {
    name: "Install script (Linux and macOS)",
    installAnchor: "install-script-linux-and-macos",
    steps: [
      {
        description: "Run the install script again; it replaces the binary.",
        stableCommand:
          "curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh",
        betaCommand:
          "curl -fsSL https://github.com/shibbirweb/sendmock/releases/download/beta/install.sh | sh -s -- --channel beta",
      },
    ],
  },
  {
    name: "Install script (Windows)",
    installAnchor: "install-script-windows",
    steps: [
      {
        description:
          "Run the install script again in PowerShell; it replaces the binary.",
        stableCommand:
          "irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex",
        betaCommand:
          "& ([scriptblock]::Create((irm https://github.com/shibbirweb/sendmock/releases/download/beta/install.ps1))) -Channel beta",
      },
    ],
  },
  {
    name: "apt (Debian and Ubuntu)",
    installAnchor: "apt-debian-and-ubuntu",
    steps: [
      {
        description: "Fetch the newest package lists.",
        stableCommand: "sudo apt update",
      },
      {
        description: "Upgrade SendMock only.",
        stableCommand: "sudo apt install --only-upgrade sendmock",
      },
    ],
  },
  {
    name: "dnf (Fedora, RHEL and similar)",
    installAnchor: "dnf-fedora-rhel-and-similar",
    steps: [
      {
        description: "Upgrade SendMock.",
        stableCommand: "sudo dnf upgrade sendmock",
      },
    ],
  },
  {
    name: "Scoop (Windows)",
    installAnchor: "scoop-windows",
    steps: [
      {
        description: "Fetch the newest manifests.",
        stableCommand: "scoop update",
      },
      {
        description: "Upgrade SendMock.",
        stableCommand: "scoop update sendmock",
        betaCommand: "scoop update sendmock-beta",
      },
    ],
  },
  {
    name: "WinGet (Windows)",
    installAnchor: "winget-windows",
    steps: [
      {
        description: "Upgrade SendMock.",
        stableCommand: "winget upgrade shibbirweb.sendmock",
      },
    ],
  },
  {
    name: "Chocolatey (Windows)",
    installAnchor: "chocolatey-windows",
    steps: [
      {
        description: "Upgrade SendMock.",
        stableCommand: "choco upgrade sendmock",
      },
    ],
  },
  {
    name: "npm (projects with Node.js)",
    installAnchor: "npm-projects-with-nodejs",
    steps: [
      {
        description: "Move your project to the newest release.",
        stableCommand: "npm install --save-dev sendmock@latest",
        betaCommand: "npm install --save-dev sendmock@beta",
      },
    ],
  },
  {
    name: "Cargo",
    installAnchor: "cargo-rust-developers",
    steps: [
      {
        description: "Install again; Cargo replaces an older version.",
        stableCommand: "cargo install sendmock --locked",
      },
    ],
  },
  {
    name: "Docker",
    installAnchor: "docker",
    steps: [
      {
        description: "Pull the newest image.",
        stableCommand: "docker pull ghcr.io/shibbirweb/sendmock",
        betaCommand: "docker pull ghcr.io/shibbirweb/sendmock:beta",
      },
      {
        description:
          "Stop the running container, then start it again with your `docker run` command.",
        stableCommand:
          "docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock",
        betaCommand:
          "docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock:beta",
      },
    ],
  },
  {
    name: "Docker Compose",
    installAnchor: "docker-compose",
    steps: [
      {
        description: "Pull the newest image named in your compose file.",
        stableCommand: "docker compose pull",
      },
      {
        description: "Recreate the SendMock container on the new image.",
        stableCommand: "docker compose up -d",
      },
    ],
  },
];

/** The command a step runs on the channel the docs version is for. */
export function chooseStepCommand(
  upgradeStep: UpgradeStep,
  isBetaChannel: boolean,
): string {
  return isBetaChannel
    ? (upgradeStep.betaCommand ?? upgradeStep.stableCommand)
    : upgradeStep.stableCommand;
}
