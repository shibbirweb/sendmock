import type {
  EmailClickRecord,
  EmailClickRequest,
  EmailDetail,
  OpenSource,
} from "@/lib/api/types";

export type RecordedMockClick = {
  clickRecord: EmailClickRecord;
  isFirstClick: boolean;
  clickCount: number;
};

/** The email timeline's wording for a click, as the backend writes it. */
export const clickTimelineDetails: Record<OpenSource, string> = {
  ui: "Link clicked in the SendMock preview",
  manual: "Link clicked with Simulate click",
  api: "Link clicked through the API",
};

/** True when the URL is one of the email's links, the only ones a provider tracks. */
export function isEmailLink(email: EmailDetail, url: string): boolean {
  return email.extracted.links.includes(url);
}

/**
 * Counts the click on the email and adds it to the click history, newest first,
 * as `POST /emails/{emailId}/clicks` does.
 */
export function recordMockClick(
  email: EmailDetail,
  clickRequest: EmailClickRequest,
  emailClicks: Map<string, EmailClickRecord[]>,
): RecordedMockClick {
  const earlierClicks = emailClicks.get(email.id) ?? [];
  const clickRecord: EmailClickRecord = {
    clicked_at: new Date().toISOString(),
    url: clickRequest.url,
    source: clickRequest.source ?? "api",
    user_agent: clickRequest.user_agent?.trim() || null,
  };
  emailClicks.set(email.id, [clickRecord, ...earlierClicks]);
  email.click_count = earlierClicks.length + 1;

  return {
    clickRecord,
    isFirstClick: !earlierClicks.some(
      (earlierClick) => earlierClick.url === clickRequest.url,
    ),
    clickCount: email.click_count,
  };
}

/** The fields `email.clicked` adds to the email. */
export function describeMockClick(
  email: EmailDetail,
  recordedClick: RecordedMockClick,
) {
  return {
    id: email.id,
    message_id: email.message_id,
    to: email.to,
    subject: email.subject,
    url: recordedClick.clickRecord.url,
    clicked_at: recordedClick.clickRecord.clicked_at,
    first_click: recordedClick.isFirstClick,
    click_count: recordedClick.clickCount,
    source: recordedClick.clickRecord.source,
    user_agent: recordedClick.clickRecord.user_agent,
  };
}
