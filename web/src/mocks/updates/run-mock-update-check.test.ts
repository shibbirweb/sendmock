import { beforeEach, describe, expect, test } from "vitest";

import {
  builtAppVersion,
  findMockInstallProfile,
  mockStableReleases,
} from "@/mocks/updates/mock-releases";
import {
  clearCachedUpdateCheck,
  runMockUpdateCheck,
  updateCheckCacheMs,
} from "@/mocks/updates/run-mock-update-check";

const startMs = Date.parse("2026-10-28T09:00:00Z");
const latestStableRelease = mockStableReleases[0];

describe("runMockUpdateCheck", () => {
  beforeEach(() => {
    clearCachedUpdateCheck();
  });

  test("PL-05.11 returns the offered release with its notes and upgrade command", () => {
    const updateCheckResult = runMockUpdateCheck({
      installProfile: findMockInstallProfile("stable-docker"),
      isGitHubReachable: true,
      nowMs: startMs,
    });

    expect(updateCheckResult?.is_update_available).toBe(true);
    expect(updateCheckResult?.available_release).toMatchObject({
      version: latestStableRelease?.version,
      published_at: `${latestStableRelease?.releasedOn}T12:00:00Z`,
      release_notes_markdown: latestStableRelease?.notesMarkdown,
      upgrade_command: `docker pull ghcr.io/shibbirweb/sendmock:${latestStableRelease?.version}`,
    });
  });

  test("UI-01.4 the demo's default install is the version it was built as, with nothing newer to offer", () => {
    const defaultInstallProfile = findMockInstallProfile("");
    expect(defaultInstallProfile.version).toBe(builtAppVersion);
    expect(builtAppVersion).toMatch(/^\d+\.\d+\.\d+/);

    expect(
      runMockUpdateCheck({
        installProfile: defaultInstallProfile,
        isGitHubReachable: true,
        nowMs: startMs,
      })?.is_update_available,
    ).toBe(false);
  });

  test("PL-05.12 keeps a check for 24 hours", () => {
    const installProfile = findMockInstallProfile("stable-docker");
    runMockUpdateCheck({
      installProfile,
      isGitHubReachable: true,
      nowMs: startMs,
    });

    const cachedResult = runMockUpdateCheck({
      installProfile,
      isGitHubReachable: false,
      nowMs: startMs + updateCheckCacheMs - 1,
    });
    expect(cachedResult?.is_from_cache).toBe(true);
    expect(cachedResult?.checked_at).toBe("2026-10-28T09:00:00.000Z");

    const freshResult = runMockUpdateCheck({
      installProfile,
      isGitHubReachable: true,
      nowMs: startMs + updateCheckCacheMs,
    });
    expect(freshResult?.is_from_cache).toBe(false);
  });

  test("PL-05.12 reports an unreachable GitHub and does not keep the failure", () => {
    const installProfile = findMockInstallProfile("beta-homebrew");

    expect(
      runMockUpdateCheck({
        installProfile,
        isGitHubReachable: false,
        nowMs: startMs,
      }),
    ).toBeNull();
    expect(
      runMockUpdateCheck({
        installProfile,
        isGitHubReachable: true,
        nowMs: startMs,
      })?.is_update_available,
    ).toBe(true);
  });

  test("PL-05.12 never asks GitHub for edge and dev builds", () => {
    const updateCheckResult = runMockUpdateCheck({
      installProfile: findMockInstallProfile("dev"),
      isGitHubReachable: false,
      nowMs: startMs,
    });

    expect(updateCheckResult).toMatchObject({
      channel: "dev",
      is_channel_checked: false,
      is_update_available: false,
      available_release: null,
    });
  });
});
