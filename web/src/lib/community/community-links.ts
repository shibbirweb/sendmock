/**
 * Where people find the project, give feedback and report problems (UI-10.1).
 * Issue forms are pre-filled with the version, channel, OS and browser only,
 * never with captured emails, messages or settings.
 */

export const repositoryUrl = "https://github.com/shibbirweb/sendmock";
export const documentationUrl = "https://shibbirweb.github.io/sendmock/docs/";
/** Release notes; the changelog page arrives with CHANGELOG.md in Phase 0. */
export const changelogUrl = `${repositoryUrl}/releases`;
/** GitHub's private vulnerability reporting, so reports are not public. */
export const securityReportUrl = `${repositoryUrl}/security/advisories/new`;

export type IssueFormKind = "bug" | "feature";

export type FeedbackEnvironment = {
  version: string;
  channel: string;
  operatingSystem: string;
  browser: string;
};

const issueFormFiles: Record<IssueFormKind, string> = {
  bug: "bug_report.yml",
  feature: "feature_request.yml",
};

/** A new issue on the matching form, its fields filled from the environment. */
export function buildIssueFormUrl(
  issueFormKind: IssueFormKind,
  feedbackEnvironment: FeedbackEnvironment,
): string {
  const searchParameters = new URLSearchParams({
    template: issueFormFiles[issueFormKind],
    version: feedbackEnvironment.version,
    channel: feedbackEnvironment.channel,
    os: feedbackEnvironment.operatingSystem,
    browser: feedbackEnvironment.browser,
  });

  return `${repositoryUrl}/issues/new?${searchParameters.toString()}`;
}

const operatingSystemPatterns: [RegExp, string][] = [
  [/Windows/i, "Windows"],
  [/iPhone|iPad|iOS/i, "iOS"],
  [/Android/i, "Android"],
  [/Mac OS X|Macintosh/i, "macOS"],
  [/Linux/i, "Linux"],
];

const browserPatterns: [RegExp, string][] = [
  [/Edg\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+).*Safari/, "Safari"],
];

/** "macOS" and "Chrome 140" from a user agent string; "Unknown" when unclear. */
export function describeEnvironment(userAgent: string): {
  operatingSystem: string;
  browser: string;
} {
  const operatingSystem =
    operatingSystemPatterns.find(([pattern]) => pattern.test(userAgent))?.[1] ??
    "Unknown";
  const browserMatch = browserPatterns
    .map(
      ([pattern, browserName]) =>
        [userAgent.match(pattern), browserName] as const,
    )
    .find(([patternMatch]) => patternMatch !== null);
  const browser = browserMatch
    ? `${browserMatch[1]} ${browserMatch[0]?.[1] ?? ""}`.trim()
    : "Unknown";

  return { operatingSystem, browser };
}
