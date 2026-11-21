import { loadBuildDownloadSources } from "@/lib/download-activity/load-build-download-sources";

import { FooterWordmarkSpotlight } from "./footer-wordmark-spotlight";

/**
 * The large SendMock wordmark at the foot of every page: its letters are a graph of how many
 * times SendMock was downloaded on each of the last 7 days, oldest on the left. The build
 * reads the numbers into the page; the browser then refreshes them from the registries it can
 * read. A soft light follows the pointer near the word. Decorative, so hidden from assistive
 * technology; the footer above already names SendMock.
 */
export async function FooterWordmark() {
  const buildSources = await loadBuildDownloadSources();

  return (
    <div className="overflow-hidden">
      <div className="mx-auto w-full max-w-5xl px-4 pt-2">
        <FooterWordmarkSpotlight buildSources={buildSources} />
      </div>
    </div>
  );
}
