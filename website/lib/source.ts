import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";

/** User docs, synced from docs/wiki/ by scripts/sync-docs.ts before every build. */
const docs = defineDocs({
  dir: "content/docs",
});

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
