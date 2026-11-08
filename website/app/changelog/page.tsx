import type { Metadata } from "next";

import { splitInlineMarkdown } from "@/lib/changelog/inline-markdown";
import { loadChangelog } from "@/lib/changelog/load-changelog";
import {
  type ChangelogRelease,
  unreleasedVersion,
} from "@/lib/changelog/parse-changelog";
import { repositoryUrl } from "@/lib/community-links";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What changed in each SendMock release: what the newest beta holds, then every stable release.",
};

function EntryText({ text }: { text: string }) {
  return splitInlineMarkdown(text).map((part, partIndex) => {
    const partKey = `${partIndex}-${part.kind}`;
    if (part.kind === "bold") {
      return (
        <strong key={partKey} className="font-semibold text-fd-foreground">
          {part.text}
        </strong>
      );
    }
    if (part.kind === "code") {
      return (
        <code key={partKey} className="font-mono text-sm">
          {part.text}
        </code>
      );
    }
    if (part.kind === "link") {
      return (
        <a key={partKey} className="underline" href={part.url}>
          {part.text}
        </a>
      );
    }
    return part.text;
  });
}

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
          {release.version === unreleasedVersion
            ? "in the newest beta, coming in the next release"
            : release.releaseDate}
        </span>
      </h2>
      {release.groups.map((group) => (
        <div key={group.heading} className="grid gap-1">
          <h3 className="font-medium">{group.heading}</h3>
          <ul className="grid list-disc gap-1 pl-5 text-fd-muted-foreground">
            {group.entries.map((entry) => (
              <li key={`${entry.pullRequestNumber}-${entry.text}`}>
                <EntryText text={entry.text} />
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
