/**
 * Writes the API playground's snippets that CI runs against a real SendMock
 * (WS-04.2) to examples/playground-snippets/playground-snippets.json.
 *
 *     bun scripts/write-playground-snippets.ts
 */
import { writeFileSync } from "node:fs";

import { loadApiReference } from "../lib/openapi/load-openapi";
import {
  buildPlaygroundSnippetSet,
  renderPlaygroundSnippetFile,
} from "../lib/playground/playground-snippet-set";
import { playgroundSnippetFilePath } from "../lib/playground/playground-snippet-file";

const apiReference = loadApiReference();
writeFileSync(
  playgroundSnippetFilePath,
  renderPlaygroundSnippetFile(
    buildPlaygroundSnippetSet(apiReference.operations, apiReference.schemas),
  ),
);
console.log(`Wrote ${playgroundSnippetFilePath}.`);
