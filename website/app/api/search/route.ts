import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// Built once at export time; the browser downloads the index and searches locally.
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source, {
  language: "english",
});
