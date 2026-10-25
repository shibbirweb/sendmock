import * as React from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useEmailList } from "@/lib/api/hooks/use-email-queries";
import { useSmsList } from "@/lib/api/hooks/use-sms-queries";
import { useTemplatePreview as useTemplatePreviewQuery } from "@/lib/api/hooks/use-webhook-template-queries";
import type {
  TemplateDraft,
  TemplateRenderRequest,
  WebhookTemplateDetail,
} from "@/lib/api/types";

export const sampleOption = "sample";
const recentMessageLimit = 5;
const draftDebounceMs = 300;

export type PreviewMessageOption = { optionValue: string; label: string };

/** "email:<id>" or "sms:<id>" from the picker, as a render request. */
function toRenderRequest(pickedOption: string): TemplateRenderRequest {
  const [messageKind, messageId] = pickedOption.split(":");
  if (messageKind === "email" && messageId !== undefined) {
    return { email_id: messageId };
  }
  if (messageKind === "sms" && messageId !== undefined) {
    return { sms_id: messageId };
  }

  return {};
}

/**
 * The message to preview with and the rendered result, of the stored
 * template or of an unsaved draft (WH-08.4, WH-09.7).
 */
export function useTemplatePreview(
  templateDetail: WebhookTemplateDetail,
  templateDraft?: TemplateDraft,
) {
  const [pickedOption, setPickedOption] = React.useState(sampleOption);
  const hasEmailEvents = templateDetail.events.some((eventType) =>
    eventType.startsWith("email."),
  );
  const hasSmsEvents = templateDetail.events.some((eventType) =>
    eventType.startsWith("sms."),
  );
  const emailListQuery = useEmailList({ limit: recentMessageLimit });
  const smsListQuery = useSmsList({ limit: recentMessageLimit });
  // Debounce the text: a new draft object every render would never settle.
  const debouncedDraftText = useDebouncedValue(
    JSON.stringify(templateDraft ?? null),
    draftDebounceMs,
  );
  const renderRequest = React.useMemo<TemplateRenderRequest>(() => {
    const debouncedDraft = JSON.parse(
      debouncedDraftText,
    ) as TemplateDraft | null;

    return debouncedDraft === null
      ? toRenderRequest(pickedOption)
      : { ...toRenderRequest(pickedOption), draft: debouncedDraft };
  }, [debouncedDraftText, pickedOption]);
  const previewQuery = useTemplatePreviewQuery(
    templateDetail.id,
    renderRequest,
  );
  const messageOptions: PreviewMessageOption[] = [
    ...(hasEmailEvents ? (emailListQuery.data?.items ?? []) : []).map(
      (emailSummary) => ({
        optionValue: `email:${emailSummary.id}`,
        label: `Email: ${emailSummary.subject || "(no subject)"}`,
      }),
    ),
    ...(hasSmsEvents ? (smsListQuery.data?.items ?? []) : []).map(
      (smsMessage) => ({
        optionValue: `sms:${smsMessage.id}`,
        label: `SMS: ${smsMessage.body.slice(0, 60)}`,
      }),
    ),
  ];

  return { pickedOption, setPickedOption, messageOptions, previewQuery };
}
