/**
 * Every guide page with its code examples and test helpers written in,
 * for `bun run examples` and its drift check (WS-08).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadExampleContract } from "./example-contract";
import type { CodeExample } from "./example-types";
import { menuExamples } from "./menu-examples";
import { applyPageSection, buildPageSections } from "./page-sections";
import { recipeExamples } from "./recipe-examples";

export const wikiDirectory = fileURLToPath(
  new URL("../../../docs/wiki", import.meta.url),
);

export const codeExamples: CodeExample[] = [...recipeExamples, ...menuExamples];

/** Page path (relative to docs/wiki) to its text with the sections written in. */
export function renderGuideExamples(): Map<string, string> {
  const renderedPages = new Map<string, string>();
  for (const pageSection of buildPageSections(
    codeExamples,
    loadExampleContract(),
  )) {
    const pageText =
      renderedPages.get(pageSection.page) ??
      readFileSync(join(wikiDirectory, pageSection.page), "utf8");
    renderedPages.set(
      pageSection.page,
      applyPageSection(pageText, pageSection),
    );
  }

  return renderedPages;
}
