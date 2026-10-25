import { StarIcon } from "lucide-react";

/**
 * The star count, read once when the site is built. GitHub may be offline or
 * the repository private; then only "GitHub" shows.
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

/** The header's GitHub link content: a star, "GitHub" and the star count. */
export async function GithubStarBadge() {
  const starCount = await fetchStarCount();

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <StarIcon aria-hidden="true" className="size-3.5" />
      GitHub
      {starCount !== null && (
        <span className="font-medium tabular-nums">
          {Intl.NumberFormat("en", { notation: "compact" }).format(starCount)}
        </span>
      )}
    </span>
  );
}
