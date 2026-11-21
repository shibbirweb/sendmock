import {
  type DownloadSource,
  type DownloadSources,
  downloadSources,
} from "./download-sources";

/** Reads a URL as JSON; resolves null (or rejects) when the registry cannot be read. */
export type FetchJson = (url: string) => Promise<unknown>;

/**
 * Reads every given source at once and keeps the ones that answered in the expected shape. A
 * source that fails is left out and never fails the others.
 */
export async function fetchDownloadSources(
  fetchJson: FetchJson,
  today: Date,
  sources: readonly DownloadSource[] = downloadSources,
): Promise<DownloadSources> {
  const answers = await Promise.allSettled(
    sources.map(async (source) =>
      source.parseDailyDownloads(await fetchJson(source.buildUrl(today))),
    ),
  );
  const fetchedSources: DownloadSources = {};
  answers.forEach((answer, sourceIndex) => {
    const sourceKey = sources[sourceIndex]?.key;
    if (sourceKey && answer.status === "fulfilled" && answer.value) {
      fetchedSources[sourceKey] = answer.value;
    }
  });
  return fetchedSources;
}

/** The sources a browser may read: the live refresh asks only these. */
export const browserReadableSources = downloadSources.filter(
  (source) => source.isBrowserReadable,
);
