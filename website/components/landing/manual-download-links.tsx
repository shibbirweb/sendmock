import { DownloadIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { sendmockReleasesUrl } from "./install-platforms";

export type ManualDownload = {
  architectureLabel: string;
  archiveFileName: string;
};

/** The release archives for one system, for readers who skip the installer. */
export function ManualDownloadLinks({
  platformLabel,
  downloads,
  className,
}: {
  platformLabel: string;
  downloads: ManualDownload[];
  className?: string;
}) {
  return (
    <div
      className={cn("mt-6 flex flex-col items-center gap-3 text-sm", className)}
    >
      <p className="font-medium">Or download the {platformLabel} binary:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {downloads.map((manualDownload) => (
          <a
            key={manualDownload.archiveFileName}
            href={`${sendmockReleasesUrl}/latest/download/${manualDownload.archiveFileName}`}
            className="inline-flex items-center gap-2 rounded-md bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <DownloadIcon aria-hidden className="size-4" />
            {manualDownload.architectureLabel}
          </a>
        ))}
      </div>
      <a
        href={`${sendmockReleasesUrl}/latest`}
        className="text-fd-muted-foreground underline underline-offset-4 hover:text-fd-foreground"
      >
        All files and checksums
      </a>
    </div>
  );
}
