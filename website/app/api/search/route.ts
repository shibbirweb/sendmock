import { createSearchAPI } from "fumadocs-core/search/server";

import { buildSiteSearchIndexes } from "@/lib/reference/search-indexes";

// Built once at export time; the browser downloads the index and searches locally.
export const revalidate = false;

export const { staticGET: GET } = createSearchAPI("advanced", {
  language: "english",
  indexes: buildSiteSearchIndexes,
});
