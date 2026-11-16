import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import Link from "next/link";

import { EntryText } from "@/components/changelog/release-section";
import { StructuredDataScript } from "@/components/seo/structured-data-script";
import { loadChangelog } from "@/lib/changelog/load-changelog";
import {
  collectUpgradeNotes,
  selectVersionReleases,
} from "@/lib/changelog/version-notes";
import { currentDocsVersion } from "@/lib/current-docs-version";
import { buildDocsPageStructuredData } from "@/lib/seo/docs-page-structured-data";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import {
  chooseStepCommand,
  upgradeChannels,
} from "@/lib/upgrade/upgrade-channels";

const pagePath = "/docs/upgrade";
const pageTitle = "Upgrade guide";
const pageDescription =
  "How to move to a newer SendMock on every install channel, and what to change for this version.";
const versionKind = currentDocsVersion?.kind;
const isBetaDocs = versionKind === "next" || versionKind === "preview";

export const metadata: Metadata = buildPageMetadata({
  title: pageTitle,
  description: pageDescription,
  pagePath,
});

function UpgradeNotesSection() {
  const upgradeNotes = collectUpgradeNotes(
    selectVersionReleases(loadChangelog(), versionKind),
  );
  if (upgradeNotes.length === 0) {
    return (
      <p data-testid="upgrade-notes-none">
        Nothing to change for this version: install it over the older one. Your
        data and settings carry over, and SendMock updates its database itself
        when it starts.
      </p>
    );
  }
  return (
    <div data-testid="upgrade-notes">
      {upgradeNotes.map((versionNotes) => (
        <section key={versionNotes.version}>
          <h3>{versionNotes.version}</h3>
          <ul>
            {versionNotes.entries.map((entry) => (
              <li key={entry.text}>
                <EntryText text={entry.text} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** How to upgrade on each channel, then this version's notes (WS-14.3). */
export default function UpgradePage() {
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
        <h2 id="what-to-change">What to change for this version</h2>
        <UpgradeNotesSection />
        <h2 id="upgrade-on-your-channel">Upgrade on your install channel</h2>
        <p>
          Use the same channel you installed SendMock with
          {isBetaDocs ? ", on the beta channel" : ""}. Then check the version
          with <code>sendmock --version</code>. The{" "}
          <Link href="/docs/whats-new">release notes</Link> list what changed.
        </p>
        {upgradeChannels.map((upgradeChannel) => (
          <section
            key={upgradeChannel.name}
            data-testid="upgrade-channel"
            aria-label={upgradeChannel.name}
          >
            <h3>{upgradeChannel.name}</h3>
            <ol>
              {upgradeChannel.steps.map((upgradeStep) => (
                <li key={upgradeStep.description}>
                  <EntryText text={upgradeStep.description} />
                  <pre>
                    <code>{chooseStepCommand(upgradeStep, isBetaDocs)}</code>
                  </pre>
                </li>
              ))}
            </ol>
            <p>
              More in{" "}
              <Link href={`/docs/install#${upgradeChannel.installAnchor}`}>
                {upgradeChannel.name} on the Install page
              </Link>
              .
            </p>
          </section>
        ))}
      </DocsBody>
    </DocsPage>
  );
}
