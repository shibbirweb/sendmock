"use client";

import { SparklesIcon } from "lucide-react";
import { useEffect } from "react";

import { detectOperatingSystem } from "@/lib/detect-operating-system";
import { cn } from "@/lib/utils";

import { AiInstallLinks, AiInstallPromptWindow } from "./ai-install-panel";
import { CopyCommandButton } from "./copy-command-button";
import { installPlatforms } from "./install-platforms";
import {
  InstallTerminal,
  InstallTerminalPlaceholder,
} from "./install-terminal";
import { ManualDownloadLinks } from "./manual-download-links";
import { SectionHeading } from "./section-heading";
import { useArrowKeyTabs } from "./use-arrow-key-tabs";

/** Overlaps an item with the others in the same grid cell; the cell takes the tallest. */
const stackedInGridCellClassName = "[grid-area:1/1]";

/**
 * Shows the intended first run; commands go live with the first beta. The AI
 * tab after the platforms holds the Install with AI prompt (WS-09.4), read from
 * the docs on the server; a docs version without it has no AI tab.
 */
export function QuickStartSection({
  installPrompt,
}: {
  installPrompt: string | null;
}) {
  const aiTabIndex = installPrompt === null ? -1 : installPlatforms.length;
  const { selectedIndex, setSelectedIndex, moveSelection, tabId, panelId } =
    useArrowKeyTabs(installPlatforms.length + (installPrompt === null ? 0 : 1));
  const isAiTabSelected = selectedIndex === aiTabIndex;
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
      className="flex flex-col items-center gap-6 px-4 py-20"
    >
      <SectionHeading
        headingId="quick-start-heading"
        eyebrow="Quick start"
        title="Install and run"
        description="One binary for macOS, Windows and Linux, or a Docker image, or let your AI agent install it. Running in under a minute."
        className="mb-4"
      />
      <div
        role="tablist"
        aria-label="Your platform"
        onKeyDown={moveSelection}
        className="flex flex-wrap justify-center gap-0.5 rounded-full border bg-fd-card p-1 sm:gap-1"
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
              "rounded-full px-2 py-1.5 text-sm font-medium transition-colors sm:px-4",
              platformIndex === selectedIndex
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {installPlatform.label}
          </button>
        ))}
        {installPrompt !== null && (
          <button
            id={tabId(aiTabIndex)}
            type="button"
            role="tab"
            aria-selected={isAiTabSelected}
            aria-controls={panelId}
            tabIndex={isAiTabSelected ? 0 : -1}
            onClick={() => setSelectedIndex(aiTabIndex)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium transition-colors sm:px-4",
              isAiTabSelected
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            <SparklesIcon aria-hidden="true" className="size-3.5" />
            AI
          </button>
        )}
      </div>
      {/*
        Every platform's finished terminal and download row sit invisibly in the
        same grid cell as the live one, so the panel does not jump in height.
      */}
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(selectedIndex)}
        className="grid w-full max-w-2xl grid-cols-[minmax(0,1fr)]"
      >
        {installPlatforms.map((installPlatform) => (
          <InstallTerminalPlaceholder
            key={installPlatform.key}
            installPlatform={installPlatform}
            className={stackedInGridCellClassName}
          />
        ))}
        {!isAiTabSelected && (
          <div
            data-testid="quick-start-terminal"
            className={cn("relative", stackedInGridCellClassName)}
          >
            <CopyCommandButton
              command={selectedPlatform.installCommand}
              className="absolute top-1.5 right-2 z-10"
            />
            {/* A new key replays the typing for the chosen platform. */}
            <InstallTerminal
              key={selectedPlatform.key}
              installPlatform={selectedPlatform}
            />
          </div>
        )}
        {installPrompt !== null && (
          <AiInstallPromptWindow
            installPrompt={installPrompt}
            isSelected={isAiTabSelected}
            className={stackedInGridCellClassName}
          />
        )}
        <div className="row-start-2 grid min-w-0 grid-cols-[minmax(0,1fr)]">
          {installPlatforms.map((installPlatform) =>
            installPlatform.downloads.length > 0 ? (
              <ManualDownloadLinks
                key={installPlatform.key}
                platformLabel={installPlatform.label}
                downloads={installPlatform.downloads}
                className={cn("invisible", stackedInGridCellClassName)}
              />
            ) : null,
          )}
          {installPrompt !== null && (
            <AiInstallLinks
              isSelected={isAiTabSelected}
              className={stackedInGridCellClassName}
            />
          )}
          {!isAiTabSelected && selectedPlatform.downloads.length > 0 ? (
            <div
              data-testid="quick-start-downloads"
              className={stackedInGridCellClassName}
            >
              <ManualDownloadLinks
                platformLabel={selectedPlatform.label}
                downloads={selectedPlatform.downloads}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
