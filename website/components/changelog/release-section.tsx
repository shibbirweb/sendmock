import { splitInlineMarkdown } from "@/lib/changelog/inline-markdown";
import {
  type ChangelogRelease,
  unreleasedVersion,
} from "@/lib/changelog/parse-changelog";
import { repositoryUrl } from "@/lib/community-links";

/** One changelog entry's text, with its bold, code and links. */
export function EntryText({ text }: { text: string }) {
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

/** One release of the changelog: its version and date, then each group's entries. */
export function ReleaseSection({ release }: { release: ChangelogRelease }) {
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
