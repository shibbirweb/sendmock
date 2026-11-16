import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import Link from "next/link";

import { ReleaseSection } from "@/components/changelog/release-section";
import { StructuredDataScript } from "@/components/seo/structured-data-script";
import { loadChangelog } from "@/lib/changelog/load-changelog";
import {
  describeWhatsNewLabel,
  selectVersionReleases,
} from "@/lib/changelog/version-notes";
import { currentDocsVersion } from "@/lib/current-docs-version";
import { buildDocsPageStructuredData } from "@/lib/seo/docs-page-structured-data";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

const pagePath = "/docs/whats-new";
const changelogReleases = loadChangelog();
const versionKind = currentDocsVersion?.kind;
const pageTitle = describeWhatsNewLabel(changelogReleases, versionKind);
const isBetaDocs = versionKind === "next" || versionKind === "preview";
const pageDescription = isBetaDocs
  ? "What the newest SendMock beta holds that the latest stable release does not, from the changelog."
  : "Every SendMock release of this version, newest first, from the changelog.";

export const metadata: Metadata = buildPageMetadata({
  title: pageTitle,
  description: pageDescription,
  pagePath,
});

/** This docs version's release notes (WS-14.2), linked from the sidebar. */
export default function WhatsNewPage() {
  const versionReleases = selectVersionReleases(changelogReleases, versionKind);

  return (
    <DocsPage>
      <StructuredDataScript
        structuredData={buildDocsPageStructuredData({
          title: pageTitle,
          description: pageDescription,
          pagePath,
          breadcrumbSteps: [{ name: pageTitle, pagePath }],
        })}
      />
      <DocsTitle>{pageTitle}</DocsTitle>
      <DocsDescription>{pageDescription}</DocsDescription>
      <DocsBody>
        <div className="not-prose grid gap-8" data-testid="whats-new-releases">
          {versionReleases.length === 0 ? (
            <p>Nothing is listed for this version yet.</p>
          ) : (
            versionReleases.map((release) => (
              <ReleaseSection key={release.version} release={release} />
            ))
          )}
        </div>
        <p>
          Moving from an older version? Read the{" "}
          <Link href="/docs/upgrade">upgrade guide</Link>. Every release is in
          the <Link href="/changelog">full changelog</Link>.
        </p>
      </DocsBody>
    </DocsPage>
  );
}
