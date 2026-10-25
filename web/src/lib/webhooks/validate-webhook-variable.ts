import type { WebhookVariable, WebhookVariableInput } from "@/lib/api/types";

const variableNamePattern = /^[a-z][a-z0-9_]*$/;
const secretNamePattern = /token|secret|key|password/;

export type WebhookVariableFieldErrors = Partial<
  Record<keyof WebhookVariableInput, string>
>;

/** Names that hold credentials are stored as masked secrets (WH-01.6). */
export function isSecretVariableName(variableName: string): boolean {
  return secretNamePattern.test(variableName);
}

/**
 * Rules for a variable, shared by the forms and the API: a lowercase name
 * unique in its scope, and a value. `existingVariables` excludes the one
 * being edited.
 */
export function validateWebhookVariableInput(
  variableInput: WebhookVariableInput,
  existingVariables: WebhookVariable[],
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
  if (variableInput.value.trim() === "") {
    fieldErrors.value = "Enter a value";
  }

  return fieldErrors;
}
