import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";

/** User docs. In Phase 0 they move to docs/wiki/ and are synced in at build time. */
const docs = defineDocs({
  dir: "content/docs",
});

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
