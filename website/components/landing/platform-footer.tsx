import { cn } from "@/lib/utils";

import { InstallDocsLinks } from "./install-docs-links";
import type { InstallPlatform } from "./install-platforms";
import { ManualDownloadLinks } from "./manual-download-links";
import { PlatformRequirementNote } from "./platform-requirement-note";

/**
 * What sits under a tab's terminal: what it needs, its downloads and the links to its full
 * steps. A placeholder copy is invisible and hidden from assistive technology, so the panel
 * keeps the height of the tallest tab.
 */
export function PlatformFooter({
  installPlatform,
  isPlaceholder,
  className,
}: {
  installPlatform: InstallPlatform;
  isPlaceholder: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden={isPlaceholder || undefined}
      className={cn(
        "flex min-w-0 flex-col",
        isPlaceholder && "invisible",
        className,
      )}
    >
      {installPlatform.requirement !== null && (
        <div
          data-testid={isPlaceholder ? undefined : "quick-start-requirement"}
        >
          <PlatformRequirementNote requirement={installPlatform.requirement} />
        </div>
      )}
      {installPlatform.downloads.length > 0 && (
        <div data-testid={isPlaceholder ? undefined : "quick-start-downloads"}>
          <ManualDownloadLinks
            platformLabel={installPlatform.label}
            downloads={installPlatform.downloads}
            downloadNote={installPlatform.downloadNote}
          />
        </div>
      )}
      <div data-testid={isPlaceholder ? undefined : "quick-start-docs-links"}>
        <InstallDocsLinks docsLinks={installPlatform.docsLinks} />
      </div>
    </div>
  );
}
