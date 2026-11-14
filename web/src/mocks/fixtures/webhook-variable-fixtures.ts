import type { WebhookVariable } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";

type VariableSpec = Pick<
  WebhookVariable,
  "name" | "kind" | "value" | "description"
> & {
  randomMode?: WebhookVariable["random_mode"];
  fixedValue?: string;
};

const variableSpecs: VariableSpec[] = [
  {
    name: "tenant_id",
    kind: "text",
    value: "acme",
    description: "Tenant sent with every request.",
  },
  {
    name: "priority",
    kind: "number",
    value: "5",
    description: "Numeric priority field.",
  },
  {
    name: "sandbox",
    kind: "boolean",
    value: "true",
    description: "Marks payloads as sandbox traffic.",
  },
  {
    name: "meta",
    kind: "json",
    value: '{"env":"local"}',
    description: "Extra metadata object.",
  },
  {
    name: "api_token",
    kind: "secret",
    value: "••••••••3f9a",
    description: "Bearer token for the app.",
  },
  {
    name: "recipient",
    kind: "dynamic",
    value: "data.to[0].address | lower",
    description: "First recipient, lowercased.",
  },
  {
    name: "nonce",
    kind: "random",
    value: "random_string(16)",
    description: "Fresh nonce per send.",
    randomMode: "per_send",
  },
  {
    name: "idempotency_seed",
    kind: "random",
    value: "random_string(12)",
    description: "Generated once; Regenerate to change it.",
    randomMode: "fixed",
    fixedValue: "k3Vq8LzP0aXm",
  },
  {
    name: "full_ref",
    kind: "computed",
    value: "{{ vars.tenant_id }}-{{ vars.nonce }}",
    description: "Tenant plus nonce.",
  },
  {
    name: "reason",
    kind: "prompt",
    value: "manual test",
    description: "Asked for on manual sends.",
  },
];

export function buildWebhookVariableFixtures(): WebhookVariable[] {
  return variableSpecs.map((variableSpec) => ({
    id: createMockUlid(),
    name: variableSpec.name,
    kind: variableSpec.kind,
    scope: "global",
    endpoint_id: null,
    value: variableSpec.value,
    random_mode: variableSpec.randomMode ?? null,
    fixed_value: variableSpec.fixedValue ?? null,
    description: variableSpec.description,
    created_by: "ui",
  }));
}
