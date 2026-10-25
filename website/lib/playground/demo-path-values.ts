import type { PlaygroundRequest, PlaygroundResponse } from "./bridge-messages";

/** Where a path parameter's value can be found in the demo data. */
type PathValueSource = {
  parameterName: string;
  /** Only for paths containing this text (`serviceSid` means two things). */
  pathIncludes?: string;
  listPath?: string;
  /** A dotted path into the first item, e.g. `credentials.0.name`. */
  field?: string;
  fixedValue?: string;
};

const pathValueSources: PathValueSource[] = [
  { parameterName: "emailId", listPath: "/api/v1/emails?limit=1", field: "id" },
  { parameterName: "smsId", listPath: "/api/v1/sms?limit=1", field: "id" },
  {
    parameterName: "verificationSid",
    listPath: "/api/v1/verify?limit=1",
    field: "sid",
  },
  {
    parameterName: "serviceSid",
    pathIncludes: "/verify/",
    listPath: "/api/v1/verify/services",
    field: "sid",
  },
  {
    parameterName: "serviceSid",
    listPath: "/api/v1/messaging-services",
    field: "sid",
  },
  { parameterName: "numberId", listPath: "/api/v1/numbers", field: "id" },
  {
    parameterName: "ruleId",
    pathIncludes: "/outcome-rules/email",
    listPath: "/api/v1/outcome-rules/email",
    field: "id",
  },
  {
    parameterName: "ruleId",
    pathIncludes: "/outcome-rules/sms",
    listPath: "/api/v1/outcome-rules/sms",
    field: "id",
  },
  { parameterName: "ruleId", listPath: "/api/v1/webhooks/rules", field: "id" },
  { parameterName: "binId", listPath: "/api/v1/http/bins", field: "id" },
  {
    parameterName: "requestId",
    pathIncludes: "/logs/http",
    listPath: "/api/v1/logs/http?limit=1",
    field: "id",
  },
  {
    parameterName: "requestId",
    listPath: "/api/v1/http/requests?limit=1",
    field: "id",
  },
  {
    parameterName: "sessionId",
    pathIncludes: "/logs/smtp",
    listPath: "/api/v1/logs/smtp?limit=1",
    field: "id",
  },
  // A payment's id opens its checkout session in the mock.
  {
    parameterName: "sessionId",
    listPath: "/api/v1/payments?limit=1",
    field: "id",
  },
  {
    parameterName: "paymentId",
    listPath: "/api/v1/payments?limit=1",
    field: "id",
  },
  { parameterName: "routeId", listPath: "/api/v1/inbound-routes", field: "id" },
  {
    parameterName: "flowKey",
    listPath: "/api/v1/payments/flows",
    field: "key",
  },
  {
    parameterName: "gatewayKey",
    listPath: "/api/v1/payments/gateways",
    field: "key",
  },
  {
    parameterName: "methodKey",
    listPath: "/api/v1/payments/methods",
    field: "key",
  },
  {
    parameterName: "endpointId",
    listPath: "/api/v1/webhooks/endpoints",
    field: "id",
  },
  {
    parameterName: "deliveryId",
    listPath: "/api/v1/webhooks/deliveries?limit=1",
    field: "id",
  },
  { parameterName: "savedId", listPath: "/api/v1/webhooks/saved", field: "id" },
  {
    parameterName: "templateId",
    listPath: "/api/v1/webhooks/templates",
    field: "id",
  },
  {
    parameterName: "variableId",
    listPath: "/api/v1/webhooks/variables",
    field: "id",
  },
  {
    parameterName: "credentialName",
    listPath: "/api/v1/payments/gateways",
    field: "credentials.0.name",
  },
  { parameterName: "kind", fixedValue: "email" },
  { parameterName: "binPath", fixedValue: "slack/hooks/test" },
  { parameterName: "revision", fixedValue: "1" },
];

function readFirstItem(responseBody: string): Record<string, unknown> | null {
  try {
    const parsedBody = JSON.parse(responseBody) as unknown;
    const items = Array.isArray(parsedBody)
      ? parsedBody
      : ((parsedBody as { items?: unknown[] }).items ?? []);
    return (items[0] as Record<string, unknown> | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * A value for each path parameter taken from the demo data, so a request to
 * `/emails/{emailId}` opens a real email instead of answering 404.
 */
export async function findDemoPathValues(
  operationPath: string,
  parameterNames: string[],
  sendRequest: (
    playgroundRequest: PlaygroundRequest,
  ) => Promise<PlaygroundResponse>,
): Promise<Record<string, string>> {
  const pathValues: Record<string, string> = {};
  for (const parameterName of parameterNames) {
    if (parameterName.endsWith("Index")) {
      pathValues[parameterName] = "0";
      continue;
    }
    const valueSource = pathValueSources.find(
      (candidateSource) =>
        candidateSource.parameterName === parameterName &&
        (candidateSource.pathIncludes === undefined ||
          operationPath.includes(candidateSource.pathIncludes)),
    );
    if (valueSource?.fixedValue !== undefined) {
      pathValues[parameterName] = valueSource.fixedValue;
    } else if (valueSource?.listPath && valueSource.field) {
      const listResponse = await sendRequest({
        method: "GET",
        path: valueSource.listPath,
        headers: {},
        body: null,
      });
      const fieldValue = valueSource.field
        .split(".")
        .reduce<unknown>(
          (currentValue, fieldName) =>
            (currentValue as Record<string, unknown> | undefined)?.[fieldName],
          readFirstItem(listResponse.body) ?? undefined,
        );
      pathValues[parameterName] = String(fieldValue ?? "");
    }
  }
  return pathValues;
}
