/**
 * Writes the shipped SMS provider definitions, webhook templates and the
 * template reference (field descriptions, functions, filters) to
 * crates/sendmock-ops/builtin/, where the binary embeds them, so the mock and
 * the runtime answer from one source (docs/plan/22-configurable-providers.md).
 * `bun scripts/export-builtin-definitions.ts` writes them; `--check` fails
 * when a committed file differs from a fresh export.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildBuiltinSmsProviders } from "../src/mocks/fixtures/sms-provider-fixtures";
import { buildWebhookTemplateFixtures } from "../src/mocks/fixtures/template-and-variable-fixtures";
import { templateDefinitions } from "../src/mocks/fixtures/template-definitions";
import { templateFieldDescriptions } from "../src/mocks/webhooks/template-field-descriptions";
import {
  templateFilterCatalog,
  templateFunctionCatalog,
} from "../src/mocks/webhooks/template-helper-catalog";

const builtinDirectory = join(
  import.meta.dir,
  "../../crates/sendmock-ops/builtin",
);

/** The gallery entries of the shipped templates, without the state the binary keeps. */
function buildBuiltinTemplateCatalogue() {
  return buildWebhookTemplateFixtures()
    .filter((webhookTemplate) => webhookTemplate.source === "builtin")
    .map((webhookTemplate) => ({
      id: webhookTemplate.id,
      name: webhookTemplate.name,
      service: webhookTemplate.service,
      category: webhookTemplate.category,
      events: webhookTemplate.events,
      description: webhookTemplate.description,
      required_variables: webhookTemplate.required_variables,
    }));
}

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
    {
      filePath: join(builtinDirectory, "webhook-template-catalogue.json"),
      content: `${JSON.stringify(buildBuiltinTemplateCatalogue(), null, 2)}\n`,
    },
    {
      filePath: join(builtinDirectory, "webhook-template-reference.json"),
      content: `${JSON.stringify(
        {
          field_descriptions: templateFieldDescriptions,
          functions: templateFunctionCatalog,
          filters: templateFilterCatalog,
        },
        null,
        2,
      )}\n`,
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
