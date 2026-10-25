import type { WebhookVariable } from "@/lib/api/types";

export type RequiredVariableState = {
  variableName: string;
  /** Where the value comes from; endpoint variables win over global ones. */
  source: "endpoint" | "global" | "missing";
};

/** Which of a template's required variables are set, and where (WH-01.6). */
export function findRequiredVariableStates(
  requiredVariableNames: string[],
  endpointVariables: WebhookVariable[],
  globalVariables: WebhookVariable[],
): RequiredVariableState[] {
  return requiredVariableNames.map((variableName) => {
    const hasVariable = (webhookVariable: WebhookVariable) =>
      webhookVariable.name === variableName;
    if (endpointVariables.some(hasVariable)) {
      return { variableName, source: "endpoint" };
    }
    if (globalVariables.some(hasVariable)) {
      return { variableName, source: "global" };
    }

    return { variableName, source: "missing" };
  });
}
