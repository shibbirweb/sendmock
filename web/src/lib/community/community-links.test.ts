import { describe, expect, test } from "vitest";

import {
  buildIssueFormUrl,
  describeEnvironment,
  securityReportUrl,
} from "@/lib/community/community-links";

const chromeOnMac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

describe("community links", () => {
  test("UI-10.1 issue forms are pre-filled with version, channel, OS and browser only", () => {
    const issueUrl = new URL(
      buildIssueFormUrl("bug", {
        version: "0.1.0-beta.1",
        channel: "beta",
        operatingSystem: "macOS",
        browser: "Chrome 140",
      }),
    );

    expect(issueUrl.pathname).toBe("/shibbirweb/sendmock/issues/new");
    expect(Object.fromEntries(issueUrl.searchParams)).toEqual({
      template: "bug_report.yml",
      version: "0.1.0-beta.1",
      channel: "beta",
      os: "macOS",
      browser: "Chrome 140",
    });
  });

  test("UI-10.1 feature requests open the feature form", () => {
    const issueUrl = new URL(
      buildIssueFormUrl("feature", {
        version: "1.0.0",
        channel: "stable",
        operatingSystem: "Linux",
        browser: "Firefox 131",
      }),
    );

    expect(issueUrl.searchParams.get("template")).toBe("feature_request.yml");
  });

  test("security reports go to private vulnerability reporting", () => {
    expect(securityReportUrl).toBe(
      "https://github.com/shibbirweb/sendmock/security/advisories/new",
    );
  });

  test("the OS and browser are read from the user agent", () => {
    expect(describeEnvironment(chromeOnMac)).toEqual({
      operatingSystem: "macOS",
      browser: "Chrome 140",
    });
    expect(
      describeEnvironment(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      ),
    ).toEqual({ operatingSystem: "Windows", browser: "Edge 140" });
    expect(describeEnvironment("curl/8.0")).toEqual({
      operatingSystem: "Unknown",
      browser: "Unknown",
    });
  });
});
