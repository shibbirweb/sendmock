import type { DailyDownloads, DownloadSources } from "./download-sources";

export const downloadActivityCacheKey = "sendmock-download-activity";
/** Each browser asks the registries at most once per four hours. */
export const downloadActivityMaxAgeMs = 4 * 60 * 60 * 1000;

export type CachedDownloadActivity = {
  savedAt: number;
  sources: DownloadSources;
};

export function encodeCachedDownloadActivity(
  sources: DownloadSources,
  savedAt: number,
): string {
  return JSON.stringify({ savedAt, sources });
}

function isDailyDownloads(candidate: unknown): candidate is DailyDownloads {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    Object.values(candidate).every((downloads) => typeof downloads === "number")
  );
}

/** Sources read back from storage or a file, or null when any of them is not day counts. */
export function parseDownloadSources(
  candidate: unknown,
): DownloadSources | null {
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }
  if (!Object.values(candidate).every(isDailyDownloads)) {
    return null;
  }
  return candidate as DownloadSources;
}

/** The inverse of `encodeCachedDownloadActivity`; null for a missing or corrupt entry. */
export function decodeCachedDownloadActivity(
  rawEntry: string | null,
): CachedDownloadActivity | null {
  if (!rawEntry) {
    return null;
  }
  try {
    const parsedEntry = JSON.parse(rawEntry) as {
      savedAt?: unknown;
      sources?: unknown;
    } | null;
    const savedAt = parsedEntry?.savedAt ?? null;
    const sources = parsedEntry?.sources ?? null;
    const parsedSources = parseDownloadSources(sources);
    if (typeof savedAt !== "number" || !parsedSources) {
      return null;
    }
    return { savedAt, sources: parsedSources };
  } catch {
    return null;
  }
}

/** Whether an entry saved at `savedAt` is younger than the maximum age; a future time is stale. */
export function isDownloadActivityFresh(
  savedAt: number,
  nowMs: number,
  maxAgeMs = downloadActivityMaxAgeMs,
): boolean {
  return savedAt <= nowMs && nowMs - savedAt < maxAgeMs;
}
