/**
 * Writes the Deeper pages into docs/wiki/deeper from their entries, the crawl's inventory and
 * the API references (WS-10). `--check` fails when a page differs from a fresh render.
 *
 *     bun scripts/write-deeper.ts [--check]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  deeperDirectory,
  renderDeeperPages,
} from "../lib/deeper/render-deeper-pages";

const renderedPages = renderDeeperPages();
if (process.argv.includes("--check")) {
  const stalePages = [...renderedPages].filter(([pageFile, freshText]) => {
    const pagePath = join(deeperDirectory, pageFile);
    return (
      !existsSync(pagePath) || readFileSync(pagePath, "utf8") !== freshText
    );
  });
  if (stalePages.length > 0) {
    console.error(
      `Out of date: ${stalePages.map(([pageFile]) => pageFile).join(", ")}. Run \`bun run deeper\` in website/.`,
    );
    process.exit(1);
  }
  console.log(`The ${renderedPages.size} Deeper pages are up to date.`);
} else {
  for (const [pageFile, freshText] of renderedPages) {
    const pagePath = join(deeperDirectory, pageFile);
    mkdirSync(dirname(pagePath), { recursive: true });
    writeFileSync(pagePath, freshText);
  }
  console.log(`Wrote ${renderedPages.size} Deeper pages.`);
}
