import type { Metadata } from "next";

import { ReleaseSection } from "@/components/changelog/release-section";
import { loadChangelog } from "@/lib/changelog/load-changelog";
import { unreleasedVersion } from "@/lib/changelog/parse-changelog";
import { repositoryUrl } from "@/lib/community-links";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Changelog",
  description:
    "What changed in each SendMock release: what the newest beta holds, then every stable release.",
  pagePath: "/changelog",
});

export default function ChangelogPage() {
  const releases = loadChangelog();
  const hasStableRelease = releases.some(
    (release) => release.version !== unreleasedVersion,
  );

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-12">
      <header className="grid gap-2">
        <h1 className="text-3xl font-bold">Changelog</h1>
        <p className="text-fd-muted-foreground">
          What changed in each release, newest first. Unreleased is what the
          newest beta holds; each stable release lists everything since the one
          before. Betas come from the <code className="font-mono">develop</code>{" "}
          branch and stables from <code className="font-mono">main</code>.
        </p>
      </header>
      {releases.map((release) => (
        <ReleaseSection key={release.version} release={release} />
      ))}
      {hasStableRelease ? null : (
        <p data-testid="changelog-empty">
          No stable release yet. Follow the betas on{" "}
          <a className="underline" href={`${repositoryUrl}/releases`}>
            GitHub
          </a>
          .
        </p>
      )}
    </main>
  );
}
