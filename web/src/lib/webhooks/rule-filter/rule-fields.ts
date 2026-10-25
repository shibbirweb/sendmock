import type { AppEventType } from "@/lib/api/types";

/** What a rule's events are about; a field only exists on some subjects. */
export type RuleSubject = "email" | "sms" | "opened" | "http";

/** How the builder asks for a value. */
export type RuleValueKind =
  "text" | "boolean" | "number" | "sms-status" | "sms-api";

export type RuleFieldDefinition = {
  fieldKey: string;
  label: string;
  subjects: RuleSubject[];
  valueKind: RuleValueKind;
};

/** `header:<name>` is stored with the name; the builder asks for it separately. */
export const headerFieldPrefix = "header:";

/** Every documented field ([05](docs/plan/05-webhooks.md#rules-automatic-mode)). */
export const ruleFieldDefinitions: RuleFieldDefinition[] = [
  {
    fieldKey: "from",
    label: "From",
    subjects: ["email", "sms"],
    valueKind: "text",
  },
  {
    fieldKey: "to",
    label: "To",
    subjects: ["email", "sms"],
    valueKind: "text",
  },
  { fieldKey: "cc", label: "Cc", subjects: ["email"], valueKind: "text" },
  {
    fieldKey: "subject",
    label: "Subject",
    subjects: ["email"],
    valueKind: "text",
  },
  {
    fieldKey: "body",
    label: "Body",
    subjects: ["email", "sms", "http"],
    valueKind: "text",
  },
  {
    fieldKey: headerFieldPrefix,
    label: "Header",
    subjects: ["email", "http"],
    valueKind: "text",
  },
  {
    fieldKey: "has_attachment",
    label: "Has attachment",
    subjects: ["email"],
    valueKind: "boolean",
  },
  { fieldKey: "tag", label: "Tag", subjects: ["email"], valueKind: "text" },
  {
    fieldKey: "status",
    label: "SMS status",
    subjects: ["sms"],
    valueKind: "sms-status",
  },
  {
    fieldKey: "api",
    label: "SMS API",
    subjects: ["sms"],
    valueKind: "sms-api",
  },
  {
    fieldKey: "open_count",
    label: "Open count",
    subjects: ["opened"],
    valueKind: "number",
  },
  {
    fieldKey: "first_open",
    label: "First open",
    subjects: ["opened"],
    valueKind: "boolean",
  },
  {
    fieldKey: "source",
    label: "Open source",
    subjects: ["opened"],
    valueKind: "text",
  },
];

/** The definition for a stored field key; `header:x-tenant` finds Header. */
export function findRuleFieldDefinition(
  fieldKey: string,
): RuleFieldDefinition | undefined {
  const lookupKey = fieldKey.startsWith(headerFieldPrefix)
    ? headerFieldPrefix
    : fieldKey;

  return ruleFieldDefinitions.find(
    (fieldDefinition) => fieldDefinition.fieldKey === lookupKey,
  );
}

/** Subjects of the selected events: `email.opened` is email and opened. */
export function readEventSubjects(events: AppEventType[]): RuleSubject[] {
  const eventSubjects = new Set<RuleSubject>();
  for (const eventType of events) {
    if (eventType.startsWith("email.")) {
      eventSubjects.add("email");
    }
    if (eventType.startsWith("sms.")) {
      eventSubjects.add("sms");
    }
    if (eventType.endsWith(".opened")) {
      eventSubjects.add("opened");
    }
  }

  return [...eventSubjects];
}

/** Fields the builder offers for the selected events. */
export function listFieldsForEvents(
  events: AppEventType[],
): RuleFieldDefinition[] {
  const eventSubjects = readEventSubjects(events);

  return ruleFieldDefinitions.filter((fieldDefinition) =>
    fieldDefinition.subjects.some((fieldSubject) =>
      eventSubjects.includes(fieldSubject),
    ),
  );
}
