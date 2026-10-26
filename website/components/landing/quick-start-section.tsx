"use client";

import { useEffect } from "react";

import {
  AnimatedSpan,
  Terminal,
  TypingAnimation,
} from "@/components/ui/terminal";
import { detectOperatingSystem } from "@/lib/detect-operating-system";
import { cn } from "@/lib/utils";

import { CopyCommandButton } from "./copy-command-button";
import { useArrowKeyTabs } from "./use-arrow-key-tabs";

/** The install scripts come from the latest GitHub release (docs/plan/10-open-questions.md, 13). */
const releaseDownloadUrl =
  "https://github.com/shibbirweb/sendmock/releases/latest/download";

/** One install command per platform; every platform then runs the same server. */
const installPlatforms = [
  {
    key: "macos",
    label: "macOS",
    prompt: "$",
    installCommand: "brew install shibbirweb/tap/sendmock",
  },
  {
    key: "windows",
    label: "Windows",
    prompt: "PS>",
    installCommand: `irm ${releaseDownloadUrl}/install.ps1 | iex`,
  },
  {
    key: "linux",
    label: "Linux",
    prompt: "$",
    installCommand: `curl -fsSL ${releaseDownloadUrl}/install.sh | sh`,
  },
];

/** Long commands wrap instead of scrolling sideways, and type faster. */
const commandLineClassName = "whitespace-pre-wrap break-all";

/** Shows the intended first run; commands go live with the first beta. */
export function QuickStartSection() {
  const { selectedIndex, setSelectedIndex, moveSelection, tabId, panelId } =
    useArrowKeyTabs(installPlatforms.length);
  const selectedPlatform =
    installPlatforms[selectedIndex] ?? installPlatforms[0];

  // The site is static, so the visitor's system is known only in the browser.
  useEffect(() => {
    const visitorPlatformIndex = installPlatforms.findIndex(
      (installPlatform) =>
        installPlatform.key === detectOperatingSystem(navigator.userAgent),
    );
    if (visitorPlatformIndex !== -1) {
      setSelectedIndex(visitorPlatformIndex);
    }
  }, [setSelectedIndex]);

  return (
    <section
      aria-labelledby="quick-start-heading"
      className="flex flex-col items-center gap-6 px-4 py-16"
    >
      <h2 id="quick-start-heading" className="text-2xl font-semibold">
        Install and run
      </h2>
      <div
        role="tablist"
        aria-label="Your operating system"
        onKeyDown={moveSelection}
        className="flex flex-wrap justify-center gap-1 rounded-full border bg-fd-card p-1"
      >
        {installPlatforms.map((installPlatform, platformIndex) => (
          <button
            key={installPlatform.key}
            id={tabId(platformIndex)}
            type="button"
            role="tab"
            aria-selected={platformIndex === selectedIndex}
            aria-controls={panelId}
            tabIndex={platformIndex === selectedIndex ? 0 : -1}
            onClick={() => setSelectedIndex(platformIndex)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              platformIndex === selectedIndex
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {installPlatform.label}
          </button>
        ))}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(selectedIndex)}
        data-testid="quick-start-terminal"
        className="relative w-full max-w-2xl"
      >
        <CopyCommandButton
          command={selectedPlatform.installCommand}
          className="absolute top-1.5 right-2 z-10"
        />
        {/* A new key replays the typing for the chosen platform. */}
        <Terminal key={selectedPlatform.key} className="max-w-2xl">
          <TypingAnimation className={commandLineClassName} duration={25}>
            {`${selectedPlatform.prompt} ${selectedPlatform.installCommand}`}
          </TypingAnimation>
          <AnimatedSpan className="text-fd-primary">
            ✔ Installed sendmock (one 12 MB binary)
          </AnimatedSpan>
          <TypingAnimation>{`${selectedPlatform.prompt} sendmock`}</TypingAnimation>
          <AnimatedSpan>SMTP listening on 127.0.0.1:1025</AnimatedSpan>
          <AnimatedSpan>Web UI and API on http://127.0.0.1:8025</AnimatedSpan>
        </Terminal>
      </div>
    </section>
  );
}
