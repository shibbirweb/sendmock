/** A small client for the GitHub REST API, using the workflow's `GITHUB_TOKEN`. */
export async function fetchGitHubJson<ParsedJson>(
  apiPath: string,
): Promise<ParsedJson> {
  const repository = process.env.GITHUB_REPOSITORY ?? "shibbirweb/sendmock";
  const token = process.env.GITHUB_TOKEN ?? "";
  const response = await fetch(
    `https://api.github.com/repos/${repository}${apiPath}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token === "" ? {} : { Authorization: `Bearer ${token}` }),
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} for ${apiPath}`);
  }
  return (await response.json()) as ParsedJson;
}

type WorkflowRunsPage = {
  workflow_runs: { conclusion: string | null; status: string }[];
};

/** The conclusion of the latest CI run for a commit, or null when none finished. */
export async function fetchCiConclusion(
  commitSha: string,
): Promise<string | null> {
  const runsPage = await fetchGitHubJson<WorkflowRunsPage>(
    `/actions/workflows/ci.yml/runs?head_sha=${commitSha}&per_page=1`,
  );
  return runsPage.workflow_runs[0]?.conclusion ?? null;
}

type PullRequestSummary = {
  number: number;
  title: string;
  merged_at: string | null;
  updated_at: string;
  head: { ref: string };
};

export async function fetchOpenReleasePullRequestNumbers(): Promise<number[]> {
  const openPullRequests = await fetchGitHubJson<PullRequestSummary[]>(
    "/pulls?state=open&base=develop&per_page=100",
  );
  return openPullRequests
    .filter((pullRequest) => pullRequest.head.ref.startsWith("release/"))
    .map((pullRequest) => pullRequest.number);
}

const maximumPagesRead = 20;

/** Pull requests merged into `develop` after a moment, with their current titles. */
export async function fetchPullRequestsMergedSince(
  sinceIsoTime: string | null,
): Promise<{ number: number; title: string }[]> {
  const mergedPullRequests: { number: number; title: string }[] = [];
  for (let pageNumber = 1; pageNumber <= maximumPagesRead; pageNumber += 1) {
    const closedPullRequests = await fetchGitHubJson<PullRequestSummary[]>(
      `/pulls?state=closed&base=develop&sort=updated&direction=desc&per_page=100&page=${pageNumber}`,
    );
    for (const pullRequest of closedPullRequests) {
      const isMergedInRange =
        pullRequest.merged_at !== null &&
        (sinceIsoTime === null || pullRequest.merged_at > sinceIsoTime);
      if (isMergedInRange) {
        mergedPullRequests.push({
          number: pullRequest.number,
          title: pullRequest.title,
        });
      }
    }
    const oldestUpdate = closedPullRequests.at(-1)?.updated_at ?? null;
    const hasReachedOlderPullRequests =
      sinceIsoTime !== null &&
      oldestUpdate !== null &&
      oldestUpdate < sinceIsoTime;
    if (closedPullRequests.length < 100 || hasReachedOlderPullRequests) {
      break;
    }
  }
  return mergedPullRequests;
}
