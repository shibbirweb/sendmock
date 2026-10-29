/**
 * Writes the shipped SMS provider definitions and webhook templates to
 * crates/sendmock-ops/builtin/, where the binary embeds them, so the mock and
 * the runtime answer from one source (docs/plan/22-configurable-providers.md).
 * `bun scripts/export-builtin-definitions.ts` writes them; `--check` fails
 * when a committed file differs from a fresh export.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildBuiltinSmsProviders } from "../src/mocks/fixtures/sms-provider-fixtures";
import { templateDefinitions } from "../src/mocks/fixtures/template-definitions";

const builtinDirectory = join(
  import.meta.dir,
  "../../crates/sendmock-ops/builtin",
);

/** Each generated file and its content, ready to write or compare. */
export function buildBuiltinDefinitionFiles(): {
  filePath: string;
  content: string;
}[] {
  return [
    {
      filePath: join(builtinDirectory, "sms-providers.json"),
      content: `${JSON.stringify(buildBuiltinSmsProviders(), null, 2)}\n`,
    },
    {
      filePath: join(builtinDirectory, "webhook-templates.json"),
      content: `${JSON.stringify(templateDefinitions, null, 2)}\n`,
    },
  ];
}

function readCommittedFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

if (import.meta.main) {
  const isCheckOnly = process.argv.includes("--check");
  const staleFiles: string[] = [];
  for (const { filePath, content } of buildBuiltinDefinitionFiles()) {
    if (isCheckOnly) {
      if (readCommittedFile(filePath) !== content) {
        staleFiles.push(filePath);
      }
    } else {
      writeFileSync(filePath, content);
    }
  }
  if (staleFiles.length > 0) {
    console.error(
      `Out of date, run bun scripts/export-builtin-definitions.ts: ${staleFiles.join(", ")}`,
    );
    process.exit(1);
  }
}
