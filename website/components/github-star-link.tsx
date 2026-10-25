import { StarIcon } from "lucide-react";

import { repositoryUrl } from "@/lib/community-links";

/**
 * The star count, read once when the site is built. GitHub may be offline or
 * the repository private; then the link shows without a count.
 */
async function fetchStarCount(): Promise<number | null> {
  try {
    const repositoryResponse = await fetch(
      "https://api.github.com/repos/shibbirweb/sendmock",
      { signal: AbortSignal.timeout(3000), cache: "force-cache" },
    );
    if (!repositoryResponse.ok) {
      return null;
    }
    const repositoryInfo = (await repositoryResponse.json()) as {
      stargazers_count?: number;
    };
    return repositoryInfo.stargazers_count ?? null;
  } catch {
    return null;
  }
}

export async function GithubStarLink() {
  const starCount = await fetchStarCount();

  return (
    <a
      href={repositoryUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={
        starCount === null
          ? "SendMock on GitHub"
          : `SendMock on GitHub, ${starCount} stars`
      }
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-fd-muted-foreground hover:text-fd-foreground"
    >
      <StarIcon aria-hidden="true" className="size-3.5" />
      GitHub
      {starCount !== null && (
        <span className="font-medium tabular-nums">
          {Intl.NumberFormat("en", { notation: "compact" }).format(starCount)}
        </span>
      )}
    </a>
  );
}
