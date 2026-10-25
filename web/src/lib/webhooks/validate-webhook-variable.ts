import type {
  VariableKind,
  WebhookVariable,
  WebhookVariableInput,
} from "@/lib/api/types";

const variableNamePattern = /^[a-z][a-z0-9_]*$/;
const secretNamePattern = /token|secret|key|password/;

export type WebhookVariableFieldErrors = Partial<
  Record<keyof WebhookVariableInput, string>
>;

/** Names that hold credentials are stored as masked secrets (WH-01.6). */
export function isSecretVariableName(variableName: string): boolean {
  return secretNamePattern.test(variableName);
}

function isJsonText(valueText: string): boolean {
  try {
    JSON.parse(valueText);
    return true;
  } catch {
    return false;
  }
}

/** One check per kind: the problem with the value, or undefined (WH-07.12). */
const valueCheckersByKind: Record<
  VariableKind,
  (valueText: string) => string | undefined
> = {
  text: (valueText) => (valueText.trim() === "" ? "Enter a value" : undefined),
  number: (valueText) =>
    valueText.trim() !== "" && Number.isFinite(Number(valueText))
      ? undefined
      : "Enter a number",
  boolean: (valueText) =>
    valueText === "true" || valueText === "false"
      ? undefined
      : "Use true or false",
  json: (valueText) => (isJsonText(valueText) ? undefined : "Enter valid JSON"),
  secret: (valueText) =>
    valueText.trim() === "" ? "Enter the secret" : undefined,
  dynamic: (valueText) =>
    valueText.trim() === ""
      ? "Enter a path or expression, e.g. data.subject"
      : undefined,
  random: (valueText) =>
    valueText.trim() === ""
      ? "Enter a generator, e.g. random_string(16)"
      : undefined,
  computed: (valueText) =>
    valueText.trim() === ""
      ? "Enter a template, e.g. {{ vars.tenant_id }}"
      : undefined,
  // A prompt may have an empty default.
  prompt: () => undefined,
};

/**
 * Rules for a variable, shared by the forms and the API: a lowercase name
 * unique in its scope, and a value that fits its kind. `existingVariables`
 * excludes the one being edited; `isKeepingStoredSecret` allows an empty
 * secret while editing, which keeps the stored one.
 */
export function validateWebhookVariableInput(
  variableInput: WebhookVariableInput,
  existingVariables: WebhookVariable[],
  isKeepingStoredSecret = false,
): WebhookVariableFieldErrors {
  const fieldErrors: WebhookVariableFieldErrors = {};

  if (!variableNamePattern.test(variableInput.name)) {
    fieldErrors.name =
      "Use lowercase letters, digits and underscores, starting with a letter";
  } else if (
    existingVariables.some(
      (existingVariable) =>
        existingVariable.name === variableInput.name &&
        existingVariable.scope === variableInput.scope &&
        existingVariable.endpoint_id === variableInput.endpoint_id,
    )
  ) {
    fieldErrors.name = "A variable with this name already exists here";
  }
  const isStoredSecretKept =
    isKeepingStoredSecret &&
    variableInput.kind === "secret" &&
    variableInput.value === "";
  const valueError = isStoredSecretKept
    ? undefined
    : valueCheckersByKind[variableInput.kind](variableInput.value);
  if (valueError !== undefined) {
    fieldErrors.value = valueError;
  }
  if (variableInput.kind === "random" && variableInput.random_mode === null) {
    fieldErrors.random_mode = "Pick Per send or Fixed";
  }

  return fieldErrors;
}
