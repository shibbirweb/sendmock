import {
  decodeCachedDownloadActivity,
  downloadActivityCacheKey,
  encodeCachedDownloadActivity,
  isDownloadActivityFresh,
} from "./download-activity-cache";
import type { DownloadSources } from "./download-sources";
import {
  browserReadableSources,
  fetchDownloadSources,
} from "./fetch-download-sources";

/** Asks a little before the footer scrolls into view, so the numbers are in place on arrival. */
const prefetchMargin = "600px 0px";
const liveRequestTimeoutMs = 8000;
/** Development skips the cache, so every reload asks the registries. */
const isDevelopment = process.env.NODE_ENV === "development";

function readCachedSources() {
  try {
    return decodeCachedDownloadActivity(
      window.localStorage.getItem(downloadActivityCacheKey),
    );
  } catch {
    return null;
  }
}

function writeCachedSources(sources: DownloadSources, savedAt: number): void {
  try {
    window.localStorage.setItem(
      downloadActivityCacheKey,
      encodeCachedDownloadActivity(sources, savedAt),
    );
  } catch {
    // Storage can be missing or full (private windows, blocked site data); the build's
    // numbers stay.
  }
}

async function fetchJsonInBrowser(
  url: string,
  signal: AbortSignal,
): Promise<unknown> {
  const registryResponse = await fetch(url, { signal });
  return registryResponse.ok ? registryResponse.json() : null;
}

/**
 * Feeds `onLiveSources` the registries' newest days. A cached answer is handed over at once,
 * even if old; when there is none or it is older than four hours, the registries a browser
 * may read are asked once `footer` nears the screen, and an answer with at least one source
 * is cached and handed over too. Returns a cleanup that cancels anything pending.
 */
export function watchLiveDownloads(
  footer: Element,
  onLiveSources: (liveSources: DownloadSources) => void,
): () => void {
  const cachedActivity = isDevelopment ? null : readCachedSources();
  if (cachedActivity) {
    onLiveSources(cachedActivity.sources);
  }
  if (
    cachedActivity &&
    isDownloadActivityFresh(cachedActivity.savedAt, Date.now())
  ) {
    return () => {};
  }

  const abortController = new AbortController();
  let timeoutId = 0;
  const loadLiveSources = () => {
    timeoutId = window.setTimeout(
      () => abortController.abort(),
      liveRequestTimeoutMs,
    );
    fetchDownloadSources(
      (url) => fetchJsonInBrowser(url, abortController.signal),
      new Date(),
      browserReadableSources,
    ).then((liveSources) => {
      window.clearTimeout(timeoutId);
      if (
        abortController.signal.aborted ||
        Object.keys(liveSources).length === 0
      ) {
        return;
      }
      if (!isDevelopment) {
        writeCachedSources(liveSources, Date.now());
      }
      onLiveSources(liveSources);
    });
  };

  const footerObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      footerObserver.disconnect();
      loadLiveSources();
    },
    { rootMargin: prefetchMargin },
  );
  footerObserver.observe(footer);

  return () => {
    footerObserver.disconnect();
    window.clearTimeout(timeoutId);
    abortController.abort();
  };
}
