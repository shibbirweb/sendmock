import type {
  MessageProviderArea,
  MessageProviderInput,
  ProviderMessagePart,
  ProviderSampleRequest,
} from "@/lib/api/types";

/** Values a sample send fills in, by area and message part. */
const sampleValues: Record<
  MessageProviderArea,
  Partial<Record<ProviderMessagePart, string>>
> = {
  email: {
    from: "app@example.test",
    to: "ana@example.test",
    subject: "Welcome to Acme",
    text: "Hi Ana, thanks for signing up.",
    html: "<p>Hi Ana, thanks for signing up.</p>",
    tags: "signup",
  },
  sms: {
    from: "+15005550006",
    to: "+15551234567",
    body: "Your Acme code is 482913",
  },
};

/** Writes `value` at a source path, creating the objects and lists on the way. */
function writeAtPath(
  targetObject: Record<string, unknown>,
  sourcePath: string,
  sampleValue: string,
) {
  const pathSteps = sourcePath
    .replace(/\[([^\]]*)\]/g, ".[$1]")
    .split(".")
    .filter((pathStep) => pathStep !== "");
  let currentContainer: Record<string, unknown> | unknown[] = targetObject;
  pathSteps.forEach((pathStep, stepIndex) => {
    const isLastStep = stepIndex === pathSteps.length - 1;
    const nextStep = pathSteps[stepIndex + 1] ?? "";
    const emptyChild = nextStep.startsWith("[") ? [] : {};
    if (pathStep.startsWith("[")) {
      const listContainer = currentContainer as unknown[];
      const selector = pathStep.slice(1, -1);
      const [selectorField, selectorValue] = selector.split("=");
      const newItem: Record<string, unknown> =
        selectorValue === undefined
          ? {}
          : { [selectorField ?? ""]: selectorValue };
      if (isLastStep) {
        listContainer.push(sampleValue);
        return;
      }
      if (selectorValue !== undefined || listContainer.length === 0) {
        listContainer.push(nextStep.startsWith("[") ? [] : newItem);
      }
      currentContainer = listContainer[listContainer.length - 1] as
        Record<string, unknown> | unknown[];
      return;
    }
    const objectContainer = currentContainer as Record<string, unknown>;
    if (isLastStep) {
      objectContainer[pathStep] = sampleValue;
      return;
    }
    objectContainer[pathStep] ??= emptyChild;
    currentContainer = objectContainer[pathStep] as
      Record<string, unknown> | unknown[];
  });
}

/** `{AccountSid}` filled from a credential of the same name, else `example`. */
function fillPath(
  operationPath: string,
  providerInput: MessageProviderInput,
): string {
  return operationPath.replace(/\{([^}]+)\}/g, (_match, partName: string) => {
    const matchingCredential = providerInput.credentials.find(
      (credential) =>
        credential.name.replace(/_/g, "").toLowerCase() ===
        partName.toLowerCase(),
    );

    return matchingCredential?.value ?? "example";
  });
}

/** A send for the preview, from the provider's first operation and its field mapping. */
export function buildSampleRequest(
  providerArea: MessageProviderArea,
  providerInput: MessageProviderInput,
): ProviderSampleRequest {
  const firstOperation = providerInput.operations[0];
  const mappedSamples = providerInput.field_mapping.flatMap((fieldMapping) => {
    const sampleValue = sampleValues[providerArea][fieldMapping.part];

    return sampleValue === undefined || fieldMapping.source.endsWith("*")
      ? []
      : [{ source: fieldMapping.source, sampleValue }];
  });
  if (firstOperation === undefined) {
    return { method: "POST", path: "/", headers: {}, body: "" };
  }
  if (firstOperation.request_format === "json") {
    const jsonBody: Record<string, unknown> = {};
    mappedSamples.forEach(({ source, sampleValue }) => {
      writeAtPath(jsonBody, source, sampleValue);
    });

    return {
      method: firstOperation.method,
      path: fillPath(firstOperation.path, providerInput),
      headers: { "content-type": "application/json" },
      body: JSON.stringify(jsonBody, null, 2),
    };
  }

  return {
    method: firstOperation.method,
    path: fillPath(firstOperation.path, providerInput),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(
      mappedSamples.map(({ source, sampleValue }) => [source, sampleValue]),
    ).toString(),
  };
}
