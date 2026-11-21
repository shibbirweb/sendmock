import { activityLevelCount } from "./activity-field";
import type { DownloadSources } from "./download-sources";
import { addDays, toUtcIsoDate } from "./utc-days";

/** How many days the wordmark shows, oldest in the "S", newest in the "k". */
export const activityDayCount = 7;

export type DownloadDay = {
  date: string;
  downloads: number;
  level: number;
};

/** The live sources replace the build's; a source only the build reads keeps its build days. */
export function mergeDownloadSources(
  buildSources: DownloadSources,
  liveSources: DownloadSources,
): DownloadSources {
  return { ...buildSources, ...liveSources };
}

/** 0 for no downloads, the top level for the busiest day, the rest in proportion. */
export function findDownloadLevel(
  downloads: number,
  busiestDownloads: number,
): number {
  if (downloads <= 0 || busiestDownloads <= 0) {
    return 0;
  }
  const topLevel = activityLevelCount - 1;
  return Math.min(
    topLevel,
    Math.ceil((topLevel * downloads) / busiestDownloads),
  );
}

/**
 * The 7 days the wordmark shows: up to the newest day any source reports, never later than
 * yesterday (UTC), so a registry that is a day behind does not leave the last day empty. With
 * no data at all, the 7 days up to yesterday, every one at level 0.
 */
export function buildDownloadDays(
  downloadSources: DownloadSources,
  today: Date,
): DownloadDay[] {
  const yesterday = addDays(toUtcIsoDate(today), -1);
  const reportedDates = Object.values(downloadSources).flatMap(
    (dailyDownloads) => Object.keys(dailyDownloads ?? {}),
  );
  const newestReportedDate = reportedDates
    .filter((date) => date <= yesterday)
    .sort()
    .at(-1);
  const lastDate = newestReportedDate ?? yesterday;
  const dates = Array.from({ length: activityDayCount }, (_, dayIndex) =>
    addDays(lastDate, dayIndex + 1 - activityDayCount),
  );
  const totals = dates.map((date) =>
    Object.values(downloadSources).reduce(
      (total, dailyDownloads) => total + (dailyDownloads?.[date] ?? 0),
      0,
    ),
  );
  const busiestDownloads = Math.max(0, ...totals);
  return dates.map((date, dayIndex) => {
    const downloads = totals[dayIndex] ?? 0;
    return {
      date,
      downloads,
      level: findDownloadLevel(downloads, busiestDownloads),
    };
  });
}
