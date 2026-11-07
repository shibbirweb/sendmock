import type {
  AppSettings,
  OpenEventRequest,
  OpenRecord,
  OpenSource,
} from "@/lib/api/types";

/** The open fields an email or SMS carries. */
type OpenableMessage = {
  id: string;
  open_count: number;
  opened_at: string | null;
};

export type RecordedMockOpen = {
  openRecord: OpenRecord;
  isFirstOpen: boolean;
};

/** The email timeline's wording for an open, as the backend writes it. */
export const openTimelineDetails: Record<OpenSource, string> = {
  ui: "Opened in the SendMock UI",
  manual: "Opened with Simulate open",
  api: "Opened through the API",
};

/**
 * Manual and API opens always count. A view in the UI counts only while the
 * auto-fire setting is on, and only the first one unless every open counts.
 */
function isOpenCounted(
  openSource: OpenSource,
  openableMessage: OpenableMessage,
  settings: AppSettings,
): boolean {
  if (openSource !== "ui") {
    return true;
  }
  if (!settings.fire_opened_events_on_view) {
    return false;
  }

  return (
    settings.opened_event_mode === "every_open" ||
    openableMessage.open_count === 0
  );
}

/**
 * Counts the open on the message and adds it to the open history, as
 * `POST /emails/{emailId}/open` and `POST /sms/{smsId}/open` do; null when the
 * settings leave the view out.
 */
export function recordMockOpen(
  openableMessage: OpenableMessage,
  openEventRequest: OpenEventRequest,
  settings: AppSettings,
  messageOpens: Map<string, OpenRecord[]>,
): RecordedMockOpen | null {
  const openSource = openEventRequest.source ?? "api";
  if (!isOpenCounted(openSource, openableMessage, settings)) {
    return null;
  }

  const openedAt = new Date().toISOString();
  openableMessage.open_count += 1;
  openableMessage.opened_at = openableMessage.opened_at ?? openedAt;
  const openRecord: OpenRecord = {
    opened_at: openedAt,
    source: openSource,
    user_agent: openEventRequest.user_agent?.trim() || null,
  };
  messageOpens.set(openableMessage.id, [
    ...(messageOpens.get(openableMessage.id) ?? []),
    openRecord,
  ]);

  return { openRecord, isFirstOpen: openableMessage.open_count === 1 };
}

/** The fields `email.opened` and `sms.opened` add to the message. */
export function describeMockOpen(
  openableMessage: OpenableMessage,
  recordedOpen: RecordedMockOpen,
) {
  return {
    id: openableMessage.id,
    opened_at: openableMessage.opened_at,
    first_open: recordedOpen.isFirstOpen,
    open_count: openableMessage.open_count,
    source: recordedOpen.openRecord.source,
    user_agent: recordedOpen.openRecord.user_agent,
  };
}

/** The open body; an empty one is `{}`, as the API reads it. */
export async function readOpenEventRequest(
  request: Request,
): Promise<OpenEventRequest> {
  const requestText = await request.text();

  return requestText.trim() === ""
    ? {}
    : (JSON.parse(requestText) as OpenEventRequest);
}
