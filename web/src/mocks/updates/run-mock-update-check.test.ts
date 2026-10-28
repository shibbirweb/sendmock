import { beforeEach, describe, expect, test } from "vitest";

import { findMockInstallProfile } from "@/mocks/updates/mock-releases";
import {
  clearCachedUpdateCheck,
  runMockUpdateCheck,
  updateCheckCacheMs,
} from "@/mocks/updates/run-mock-update-check";

const startMs = Date.parse("2026-10-28T09:00:00Z");

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
      version: "0.1.1",
      published_at: "2026-10-18T14:00:00Z",
      upgrade_command: "docker pull ghcr.io/shibbirweb/sendmock:0.1.1",
    });
    expect(
      updateCheckResult?.available_release?.release_notes_markdown,
    ).toContain("### Fixed");
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
