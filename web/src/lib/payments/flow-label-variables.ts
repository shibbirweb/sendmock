import type { PaymentFlowStep, PaymentFlowVariable } from "@/lib/api/types";

export type FlowVariableName =
  | "method"
  | "amount"
  | "currency"
  | "merchant"
  | "gateway"
  | "reference"
  | "customer_email";

/** What each variable becomes on a checkout page. */
export type FlowVariableValues = Record<FlowVariableName, string>;

/**
 * The variables a step label can use, in the order the reference lists them
 * (17-payments, PY-12.7). The examples are what the Flows sheet previews with.
 */
export const flowLabelVariables: (PaymentFlowVariable & {
  name: FlowVariableName;
})[] = [
  {
    name: "method",
    token: "{method}",
    description: "The payment method's name",
    example: "bKash",
  },
  {
    name: "amount",
    token: "{amount}",
    description: "The amount to pay, in the currency's format",
    example: "BDT 1,200.00",
  },
  {
    name: "currency",
    token: "{currency}",
    description: "The currency code",
    example: "BDT",
  },
  {
    name: "merchant",
    token: "{merchant}",
    description: "The merchant name shown on checkout pages",
    example: "Acme Shop",
  },
  {
    name: "gateway",
    token: "{gateway}",
    description: "The gateway's name",
    example: "SSLCommerz",
  },
  {
    name: "reference",
    token: "{reference}",
    description: "The payment reference the customer quotes",
    example: "SM-8F2KD9XL",
  },
  {
    name: "customer_email",
    token: "{customer_email}",
    description: "The customer's email, or empty when there is none",
    example: "ruma@example.com",
  },
];

const variablePattern = /\{([a-z_]+)\}/g;

const knownVariableNames = new Set<string>(
  flowLabelVariables.map((flowVariable) => flowVariable.name),
);

/** The example values, with the method's name when a method is known. */
export function buildExampleVariableValues(
  methodName?: string,
): FlowVariableValues {
  const exampleValues = Object.fromEntries(
    flowLabelVariables.map((flowVariable) => [
      flowVariable.name,
      flowVariable.example,
    ]),
  ) as FlowVariableValues;

  return methodName === undefined
    ? exampleValues
    : { ...exampleValues, method: methodName };
}

/** A label with its variables filled in; unknown ones stay as written. */
export function fillStepLabel(
  stepLabel: string,
  variableValues: FlowVariableValues,
): string {
  return stepLabel.replace(variablePattern, (variableToken, variableName) =>
    knownVariableNames.has(variableName)
      ? variableValues[variableName as FlowVariableName]
      : variableToken,
  );
}

/** Every label of a step filled in, as the checkout page shows it. */
export function fillStepLabels(
  flowStep: PaymentFlowStep,
  variableValues: FlowVariableValues,
): PaymentFlowStep {
  return {
    type: flowStep.type,
    title: fillStepLabel(flowStep.title, variableValues),
    field_label: fillStepLabel(flowStep.field_label, variableValues),
    hint: fillStepLabel(flowStep.hint, variableValues),
    button_label: fillStepLabel(flowStep.button_label, variableValues),
  };
}

/** `{methd}` and other variables a label uses that do not exist. */
export function findUnknownVariables(stepLabel: string): string[] {
  return [...stepLabel.matchAll(variablePattern)]
    .filter((variableMatch) => !knownVariableNames.has(variableMatch[1] ?? ""))
    .map((variableMatch) => variableMatch[0]);
}

/** "SM-01HZX4F2" from the session, so each checkout has its own reference. */
export function readPaymentReference(sessionId: string): string {
  return `SM-${sessionId.slice(-8).toUpperCase()}`;
}
