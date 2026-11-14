/**
 * Writes the code examples and test helpers into docs/wiki
 * (docs/plan/21-reference-and-examples.md, WS-08). `--check` fails when a
 * page differs from a fresh render instead of writing it.
 *
 *     bun scripts/write-examples.ts [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  renderGuideExamples,
  wikiDirectory,
} from "../lib/examples/render-guide-examples";

const renderedPages = renderGuideExamples();
if (process.argv.includes("--check")) {
  const stalePages = [...renderedPages].filter(
    ([page, freshText]) =>
      readFileSync(join(wikiDirectory, page), "utf8") !== freshText,
  );
  if (stalePages.length > 0) {
    console.error(
      `Out of date: ${stalePages.map(([page]) => page).join(", ")}. Run \`bun run examples\` in website/.`,
    );
    process.exit(1);
  }
  console.log(
    `The code examples on ${renderedPages.size} pages are up to date.`,
  );
} else {
  for (const [page, freshText] of renderedPages) {
    writeFileSync(join(wikiDirectory, page), freshText);
  }
  console.log(`Wrote the code examples on ${renderedPages.size} pages.`);
}
