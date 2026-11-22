import type { HttpFollowUpWebhook } from "@/lib/api/types";

/** The follow-up webhook as typed; the delay stays text until saving. */
export type FollowUpFormValues = {
  isEnabled: boolean;
  targetKind: "url" | "endpoint";
  url: string;
  endpointId: string;
  templateId: string;
  delayMs: string;
};

export function toFollowUpFormValues(
  followUp: HttpFollowUpWebhook | null,
): FollowUpFormValues {
  return {
    isEnabled: followUp !== null,
    targetKind: followUp?.endpoint_id ? "endpoint" : "url",
    url: followUp?.url ?? "",
    endpointId: followUp?.endpoint_id ?? "",
    templateId: followUp?.template_id ?? "native",
    delayMs: String(followUp?.delay_ms ?? 0),
  };
}

export function toFollowUp(
  formValues: FollowUpFormValues,
): HttpFollowUpWebhook | null {
  if (!formValues.isEnabled) {
    return null;
  }
  const isEndpoint = formValues.targetKind === "endpoint";
  return {
    url: isEndpoint ? "" : formValues.url.trim(),
    endpoint_id:
      isEndpoint && formValues.endpointId !== "" ? formValues.endpointId : null,
    template_id: formValues.templateId,
    delay_ms: Number(formValues.delayMs),
  };
}
