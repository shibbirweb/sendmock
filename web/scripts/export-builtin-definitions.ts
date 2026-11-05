/**
 * Writes the shipped SMS provider definitions, webhook templates and the
 * template reference (field descriptions, functions, filters), and the payment
 * flows, methods, step types and label variables to
 * crates/sendmock-ops/builtin/ (and the payment event names the `payment_event`
 * filter reads to crates/sendmock-core/), where the binary embeds them, so the mock and
 * the runtime answer from one source (docs/plan/22-configurable-providers.md).
 * `bun scripts/export-builtin-definitions.ts` writes them; `--check` fails
 * when a committed file differs from a fresh export.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { flowLabelVariables } from "../src/lib/payments/flow-label-variables";
import { paymentProviderEventNames } from "../src/lib/payments/payment-provider-event-names";
import { paymentStepCatalogue } from "../src/lib/payments/payment-step-catalogue";
import { buildBuiltinPaymentFlows } from "../src/mocks/fixtures/payment-flow-fixtures";
import { buildBuiltinPaymentGateways } from "../src/mocks/fixtures/payment-gateway-fixtures";
import { buildBuiltinPaymentMethods } from "../src/mocks/fixtures/payment-method-fixtures";
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
/** The template engine lives in the core crate, so its event name table is written there. */
const coreTemplateDirectory = join(
  import.meta.dir,
  "../../crates/sendmock-core/src/template",
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
      filePath: join(builtinDirectory, "payment-flows.json"),
      content: `${JSON.stringify(buildBuiltinPaymentFlows(), null, 2)}\n`,
    },
    {
      filePath: join(builtinDirectory, "payment-methods.json"),
      content: `${JSON.stringify(buildBuiltinPaymentMethods(), null, 2)}\n`,
    },
    {
      filePath: join(builtinDirectory, "payment-gateways.json"),
      content: `${JSON.stringify(buildBuiltinPaymentGateways(null), null, 2)}\n`,
    },
    {
      filePath: join(builtinDirectory, "payment-step-types.json"),
      content: `${JSON.stringify(Object.values(paymentStepCatalogue), null, 2)}\n`,
    },
    {
      filePath: join(builtinDirectory, "payment-flow-variables.json"),
      content: `${JSON.stringify(
        flowLabelVariables.map(({ name, token, description, example }) => ({
          name,
          token,
          description,
          example,
        })),
        null,
        2,
      )}\n`,
    },
    {
      filePath: join(coreTemplateDirectory, "payment-event-names.json"),
      content: `${JSON.stringify(paymentProviderEventNames, null, 2)}\n`,
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
