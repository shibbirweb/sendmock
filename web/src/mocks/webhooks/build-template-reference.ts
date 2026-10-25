import type {
  AppEventType,
  TemplateReference,
  TemplateReferenceField,
  TemplateValueType,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { buildSampleSubject } from "@/mocks/webhooks/build-template-context";
import { templateFieldDescriptions } from "@/mocks/webhooks/template-field-descriptions";
import {
  templateFilterCatalog,
  templateFunctionCatalog,
} from "@/mocks/webhooks/template-helper-catalog";

const exampleLengthLimit = 60;

function readValueType(sampleValue: unknown): TemplateValueType {
  if (Array.isArray(sampleValue)) {
    return "list";
  }
  if (sampleValue !== null && typeof sampleValue === "object") {
    return "object";
  }
  if (typeof sampleValue === "number") {
    return "number";
  }
  if (typeof sampleValue === "boolean") {
    return "boolean";
  }
  if (
    typeof sampleValue === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(sampleValue)
  ) {
    return "timestamp";
  }

  return "string";
}

function toExample(sampleValue: unknown): string | null {
  if (
    sampleValue === null ||
    sampleValue === undefined ||
    typeof sampleValue === "object"
  ) {
    return null;
  }

  const exampleText = String(sampleValue);

  return exampleText.length > exampleLengthLimit
    ? `${exampleText.slice(0, exampleLengthLimit)}...`
    : exampleText;
}

/** `data.to[0].address` to `data.to[].address`, the key of the descriptions. */
function toDescriptionKey(fieldPath: string): string {
  return fieldPath.replace(/\[\d+\]/g, "[]");
}

/** A field and its children from a sample value; lists show their first item as `[0]`. */
function buildField(
  fieldPath: string,
  fieldName: string,
  sampleValue: unknown,
): TemplateReferenceField {
  const valueType = readValueType(sampleValue);
  let children: TemplateReferenceField[] = [];
  if (valueType === "object") {
    children = Object.entries(sampleValue as Record<string, unknown>).map(
      ([childName, childValue]) =>
        buildField(`${fieldPath}.${childName}`, childName, childValue),
    );
  } else if (valueType === "list" && (sampleValue as unknown[]).length > 0) {
    const firstItem = (sampleValue as unknown[])[0];
    children = [buildField(`${fieldPath}[0]`, "[0]", firstItem)];
  }

  return {
    path: fieldPath,
    name: fieldName,
    value_type: valueType,
    description: templateFieldDescriptions[toDescriptionKey(fieldPath)] ?? "",
    example: toExample(sampleValue),
    children,
  };
}

/** The sample `data` for each kind of chosen event, merged; email first. */
function buildMergedSampleData(
  events: AppEventType[],
): Record<string, unknown> {
  const sampleEvents: AppEventType[] =
    events.length === 0 ? ["email.received"] : events;
  const representativeEvents = [
    sampleEvents.find((eventType) => eventType.startsWith("email.")),
    sampleEvents.find((eventType) => eventType.startsWith("sms.")),
    sampleEvents.find((eventType) => eventType === "webhook.failed"),
  ].filter((eventType): eventType is AppEventType => eventType !== undefined);

  return Object.assign(
    {},
    ...representativeEvents.map(
      (eventType) => buildSampleSubject(eventType).data,
    ),
  ) as Record<string, unknown>;
}

/** Everything a template can read for the chosen events, plus functions and filters (WH-07.9). */
export function buildTemplateReference(
  mockDatabase: MockDatabase,
  events: AppEventType[],
): TemplateReference {
  const globalVariables = mockDatabase.webhookVariables.filter(
    (webhookVariable) => webhookVariable.scope === "global",
  );
  const variablesField: TemplateReferenceField = {
    ...buildField("vars", "vars", {}),
    value_type: "object",
    children: globalVariables.map((webhookVariable) => ({
      path: `vars.${webhookVariable.name}`,
      name: webhookVariable.name,
      value_type:
        webhookVariable.kind === "number"
          ? "number"
          : webhookVariable.kind === "boolean"
            ? "boolean"
            : "string",
      description:
        `${webhookVariable.kind} variable. ${webhookVariable.description}`.trim(),
      example: webhookVariable.value,
      children: [],
    })),
  };
  const contextSample = {
    event: {
      id: "evt_01JB7T9Q2R",
      type: events[0] ?? "email.received",
      created_at: "2026-10-25T09:30:00.000Z",
    },
    data: buildMergedSampleData(events),
    endpoint: {
      name: "Laravel inbound mail",
      url: "http://localhost:8000/webhooks/inbound-mail",
    },
    delivery: { id: "01JB7T9Q2RDELIVERY0000000", attempt: 1, trigger: "auto" },
    rule: {
      id: "01JB7T9Q2RRULE000000000000",
      name: "Support inbox to Laravel",
    },
    sendmock: { version: "0.0.0-dev", http_url: "http://127.0.0.1:8025" },
    request_id: "01JB7T9Q2RREQUEST00000000",
  };
  const contextFields = Object.entries(contextSample).map(
    ([fieldName, sampleValue]) => buildField(fieldName, fieldName, sampleValue),
  );

  return {
    fields: [
      contextFields[0],
      contextFields[1],
      variablesField,
      ...contextFields.slice(2),
    ].filter((field): field is TemplateReferenceField => field !== undefined),
    functions: templateFunctionCatalog,
    filters: templateFilterCatalog,
  };
}
