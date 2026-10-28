import type { UpdateCheckResult } from "@/lib/api/types";
import { buildUpgradeCommand } from "@/mocks/updates/build-upgrade-command";
import {
  type MockInstallProfile,
  mockPublishedReleases,
} from "@/mocks/updates/mock-releases";
import {
  isChannelChecked,
  selectOfferedRelease,
} from "@/mocks/updates/select-offered-release";

/** A check is kept this long before GitHub is asked again (PL-05.12). */
export const updateCheckCacheMs = 24 * 60 * 60 * 1000;

type CachedUpdateCheck = {
  installProfileKey: string;
  checkedAtMs: number;
  updateCheckResult: UpdateCheckResult;
};

let cachedUpdateCheck: CachedUpdateCheck | null = null;

export function clearCachedUpdateCheck() {
  cachedUpdateCheck = null;
}

function buildUpdateCheckResult(
  installProfile: MockInstallProfile,
  checkedAtMs: number,
): UpdateCheckResult {
  const offeredRelease = selectOfferedRelease({
    currentVersion: installProfile.version,
    releaseChannel: installProfile.releaseChannel,
    publishedReleases: mockPublishedReleases,
  });

  return {
    current_version: installProfile.version,
    channel: installProfile.releaseChannel,
    install_method: installProfile.installMethod,
    is_channel_checked: isChannelChecked(installProfile.releaseChannel),
    is_update_available: offeredRelease !== null,
    available_release:
      offeredRelease === null
        ? null
        : {
            version: offeredRelease.version,
            published_at: offeredRelease.publishedAt,
            release_notes_markdown: offeredRelease.releaseNotesMarkdown,
            release_url: `https://github.com/shibbirweb/sendmock/releases/tag/v${offeredRelease.version}`,
            upgrade_command: buildUpgradeCommand({
              installMethod: installProfile.installMethod,
              operatingSystem: installProfile.operatingSystem,
              releaseChannel: installProfile.releaseChannel,
              offeredVersion: offeredRelease.version,
            }),
          },
    checked_at: new Date(checkedAtMs).toISOString(),
    is_from_cache: false,
  };
}

/**
 * The update check as the server will run it: edge and dev builds never ask
 * GitHub; others answer from the last check for 24 hours, otherwise ask
 * GitHub, and keep only successful answers so an unreachable GitHub is asked
 * again next time, never in a loop. Null means GitHub could not be reached.
 */
export function runMockUpdateCheck({
  installProfile,
  isGitHubReachable,
  nowMs,
}: {
  installProfile: MockInstallProfile;
  isGitHubReachable: boolean;
  nowMs: number;
}): UpdateCheckResult | null {
  if (!isChannelChecked(installProfile.releaseChannel)) {
    return buildUpdateCheckResult(installProfile, nowMs);
  }
  if (
    cachedUpdateCheck !== null &&
    cachedUpdateCheck.installProfileKey === installProfile.key &&
    nowMs - cachedUpdateCheck.checkedAtMs < updateCheckCacheMs
  ) {
    return { ...cachedUpdateCheck.updateCheckResult, is_from_cache: true };
  }
  if (!isGitHubReachable) {
    return null;
  }
  const updateCheckResult = buildUpdateCheckResult(installProfile, nowMs);
  cachedUpdateCheck = {
    installProfileKey: installProfile.key,
    checkedAtMs: nowMs,
    updateCheckResult,
  };

  return updateCheckResult;
}
