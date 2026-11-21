/**
 * What is open on the repository's Security tab and in Dependabot's pull requests (PL-19.5), so
 * Prepare release refuses to start until the tab is clean. Reads the GitHub REST API.
 */
import { fetchGitHubJson } from "./github-api";

type CodeScanningAlert = {
  number: number;
  rule: { id: string };
  most_recent_instance: { location: { path: string } };
};

type DependabotAlert = {
  number: number;
  dependency: { package: { name: string }; manifest_path: string };
};

type OpenPullRequest = {
  number: number;
  title: string;
  user: { login: string };
};

export type SecurityItems = {
  codeScanningAlerts: string[];
  dependabotAlerts: string[];
  dependabotPullRequests: string[];
};

const dependabotLogin = "dependabot[bot]";

/** Dependabot's own pull requests among the open ones, as `#n title`. */
export function selectDependabotPullRequests(
  openPullRequests: OpenPullRequest[],
): string[] {
  return openPullRequests
    .filter((pullRequest) => pullRequest.user.login === dependabotLogin)
    .map((pullRequest) => `#${pullRequest.number} ${pullRequest.title}`);
}

async function fetchCodeScanningAlerts(): Promise<string[]> {
  const openAlerts = await fetchGitHubJson<CodeScanningAlert[]>(
    "/code-scanning/alerts?state=open&ref=refs/heads/main&per_page=100",
  );
  return openAlerts.map(
    (alert) =>
      `#${alert.number} ${alert.rule.id} in ${alert.most_recent_instance.location.path}`,
  );
}

// The workflow's GITHUB_TOKEN cannot read Dependabot alerts, so this call takes a token that
// can (SECURITY_ALERTS_TOKEN, which the workflow sets from RELEASE_TOKEN).
async function fetchDependabotAlerts(): Promise<string[]> {
  const alertsToken =
    process.env.SECURITY_ALERTS_TOKEN || process.env.GITHUB_TOKEN || "";
  try {
    const openAlerts = await fetchGitHubJson<DependabotAlert[]>(
      "/dependabot/alerts?state=open&per_page=100",
      alertsToken,
    );
    return openAlerts.map(
      (alert) =>
        `#${alert.number} ${alert.dependency.package.name} in ${alert.dependency.manifest_path}`,
    );
  } catch (fetchError) {
    throw new Error(
      `Could not read the Dependabot alerts (${String(fetchError)}). Give RELEASE_TOKEN the "Dependabot alerts: read" permission (docs/plan/31-release-runbook.md, step 3).`,
    );
  }
}

async function fetchDependabotPullRequests(): Promise<string[]> {
  const openPullRequests = await fetchGitHubJson<OpenPullRequest[]>(
    "/pulls?state=open&per_page=100",
  );
  return selectDependabotPullRequests(openPullRequests);
}

export async function fetchSecurityItems(): Promise<SecurityItems> {
  return {
    codeScanningAlerts: await fetchCodeScanningAlerts(),
    dependabotAlerts: await fetchDependabotAlerts(),
    dependabotPullRequests: await fetchDependabotPullRequests(),
  };
}
