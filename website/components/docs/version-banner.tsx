import { Banner } from "fumadocs-ui/components/banner";

import {
  currentDocsVersion,
  stableDocsVersion,
} from "@/lib/current-docs-version";

const bannerMessages = {
  next: "Beta docs: they follow develop and the beta channel.",
  preview:
    "Preview: SendMock has no stable release yet. These docs follow develop.",
  older: `Docs for ${currentDocsVersion?.label ?? "an older version"}, an older release.`,
};

/** Shown on every page of a non-stable docs version (WS-03.7). */
export function VersionBanner() {
  if (
    currentDocsVersion === undefined ||
    currentDocsVersion.kind === "stable"
  ) {
    return null;
  }

  return (
    <Banner
      data-testid="docs-version-banner"
      className="gap-2 bg-fd-secondary px-4 text-center text-sm text-fd-foreground"
    >
      <span>{bannerMessages[currentDocsVersion.kind]}</span>
      {stableDocsVersion !== undefined && (
        <a
          href={`${stableDocsVersion.href}docs/`}
          className="font-medium underline underline-offset-4"
        >
          Read the {stableDocsVersion.label} docs
        </a>
      )}
    </Banner>
  );
}
