/**
 * Copies the user docs from docs/wiki/ (the source of truth, plain Markdown
 * that also reads well on GitHub) into content/docs/ for Fumadocs. Runs before
 * `dev` and `build`; content/docs/ is generated and not committed.
 */
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wikiDirectory = fileURLToPath(
  new URL("../../docs/wiki", import.meta.url),
);
const contentDirectory = fileURLToPath(
  new URL("../content/docs", import.meta.url),
);

rmSync(contentDirectory, { recursive: true, force: true });
cpSync(wikiDirectory, contentDirectory, { recursive: true });
console.log("Synced docs/wiki into content/docs.");
