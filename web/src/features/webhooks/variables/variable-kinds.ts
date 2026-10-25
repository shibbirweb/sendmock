import type { VariableKind } from "@/lib/api/types";

/** Kind cards in the sheet, in plan order ([12](docs/plan/12-webhook-variables.md#variable-kinds)). */
export const variableKindOptions: {
  value: VariableKind;
  label: string;
  description: string;
}[] = [
  {
    value: "text",
    label: "Text",
    description: "A fixed piece of text, e.g. a tenant id.",
  },
  {
    value: "number",
    label: "Number",
    description: "A fixed number, sent unquoted in fields.",
  },
  { value: "boolean", label: "Boolean", description: "true or false." },
  { value: "json", label: "JSON", description: "A fixed object or list." },
  {
    value: "secret",
    label: "Secret",
    description: "A token or key: masked everywhere, never shown again.",
  },
  {
    value: "dynamic",
    label: "Dynamic",
    description: "Read from the event, e.g. data.to[0].address | lower.",
  },
  {
    value: "random",
    label: "Random",
    description: "Generated per send or once, e.g. random_string(16).",
  },
  {
    value: "computed",
    label: "Computed",
    description: "A template made of other variables.",
  },
  {
    value: "prompt",
    label: "Prompt",
    description: "Asked for on manual sends; the default is used otherwise.",
  },
];

export const variableKindLabels = Object.fromEntries(
  variableKindOptions.map((kindOption) => [kindOption.value, kindOption.label]),
) as Record<VariableKind, string>;
