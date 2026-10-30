import type { Metadata } from "next";

import { loadChangelog } from "@/lib/changelog/load-changelog";
import type { ChangelogRelease } from "@/lib/changelog/parse-changelog";
import { repositoryUrl } from "@/lib/community-links";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What changed in each SendMock release, beta and stable, written from the merged pull requests.",
};

function ReleaseSection({ release }: { release: ChangelogRelease }) {
  return (
    <section
      aria-labelledby={`release-${release.version}`}
      className="grid gap-3"
      data-testid="changelog-release"
    >
      <h2 id={`release-${release.version}`} className="text-xl font-semibold">
        {release.version}{" "}
        <span className="text-base font-normal text-fd-muted-foreground">
          {release.releaseDate}
        </span>
      </h2>
      {release.groups.map((group) => (
        <div key={group.heading} className="grid gap-1">
          <h3 className="font-medium">{group.heading}</h3>
          <ul className="grid list-disc gap-1 pl-5 text-fd-muted-foreground">
            {group.entries.map((entry) => (
              <li key={`${entry.pullRequestNumber}-${entry.text}`}>
                {entry.text}
                {entry.pullRequestNumber === null ? null : (
                  <>
                    {" "}
                    <a
                      className="underline"
                      href={`${repositoryUrl}/pull/${entry.pullRequestNumber}`}
                    >
                      #{entry.pullRequestNumber}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default function ChangelogPage() {
  const releases = loadChangelog();

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-12">
      <header className="grid gap-2">
        <h1 className="text-3xl font-bold">Changelog</h1>
        <p className="text-fd-muted-foreground">
          What changed in each release, newest first. Betas come from the{" "}
          <code className="font-mono">develop</code> branch and stables from{" "}
          <code className="font-mono">main</code>.
        </p>
      </header>
      {releases.length === 0 ? (
        <p data-testid="changelog-empty">
          No releases yet. Follow the first beta on{" "}
          <a className="underline" href={`${repositoryUrl}/releases`}>
            GitHub
          </a>
          .
        </p>
      ) : (
        releases.map((release) => (
          <ReleaseSection key={release.version} release={release} />
        ))
      )}
    </main>
  );
}
