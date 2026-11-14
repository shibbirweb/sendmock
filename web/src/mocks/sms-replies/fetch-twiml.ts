import { faker } from "@faker-js/faker/locale/en";

import type { SmsReplyWebhookAttempt, TwimlVerb } from "@/lib/api/types";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import { answerMockAppRequest } from "@/mocks/sms-replies/mock-app-responses";
import { parseTwiml } from "@/mocks/sms-replies/parse-twiml";

/** Twilio reads these answers as TwiML; `text/plain` is the reply text itself. */
const twimlContentTypes = ["text/xml", "application/xml", "text/html"];

function buildPlainTextReply(replyText: string): TwimlVerb {
  return {
    verb: "Message",
    body: replyText.trim(),
    to: null,
    from: null,
    status_callback: null,
    action: null,
    method: "POST",
    media_urls: [],
  };
}

export type FetchOutcome = {
  attempt: SmsReplyWebhookAttempt;
  verbs: TwimlVerb[];
  isSucceeded: boolean;
};

/** One fetch of a reply webhook URL, read as Twilio reads it (04-sms errors). */
export function fetchTwiml(
  requestUrl: string,
  requestMethod: "GET" | "POST",
  twilioFields: Record<string, string>,
  isFallback: boolean,
  createdAtMs: number,
): FetchOutcome {
  const encodedFields = new URLSearchParams(twilioFields).toString();
  const mockAnswer = answerMockAppRequest(requestUrl);
  const baseAttempt = {
    id: createMockUlid(createdAtMs),
    is_fallback: isFallback,
    request: {
      method: requestMethod,
      url:
        requestMethod === "GET" ? `${requestUrl}?${encodedFields}` : requestUrl,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "TwilioProxy/1.1",
        "x-twilio-signature": `${faker.string.alphanumeric(27)}=`,
        "i-twilio-idempotency-token": faker.string.uuid(),
      },
      body: requestMethod === "GET" ? "" : encodedFields,
    },
    created_at: new Date(createdAtMs).toISOString(),
  };
  if (mockAnswer.kind === "connection_error") {
    return {
      attempt: {
        ...baseAttempt,
        response: null,
        duration_ms: null,
        error_code: "11205",
        error_message: `HTTP connection failure: ${mockAnswer.message}`,
        twiml: [],
      },
      verbs: [],
      isSucceeded: false,
    };
  }
  const response = {
    status_code: mockAnswer.statusCode,
    headers: { "content-type": mockAnswer.contentType },
    body: mockAnswer.body,
    is_body_truncated: false,
  };
  const failWith = (errorCode: string, errorMessage: string): FetchOutcome => ({
    attempt: {
      ...baseAttempt,
      response,
      duration_ms: mockAnswer.durationMs,
      error_code: errorCode,
      error_message: errorMessage,
      twiml: [],
    },
    verbs: [],
    isSucceeded: false,
  });
  if (mockAnswer.statusCode < 200 || mockAnswer.statusCode > 299) {
    return failWith(
      "11200",
      `HTTP retrieval failure: ${mockAnswer.statusCode}`,
    );
  }
  if (mockAnswer.statusCode === 204 || mockAnswer.body.trim() === "") {
    return {
      attempt: {
        ...baseAttempt,
        response,
        duration_ms: mockAnswer.durationMs,
        error_code: null,
        error_message: null,
        twiml: [],
      },
      verbs: [],
      isSucceeded: true,
    };
  }
  const mediaType =
    mockAnswer.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mediaType === "text/plain") {
    const plainTextVerbs = [buildPlainTextReply(mockAnswer.body)];
    return {
      attempt: {
        ...baseAttempt,
        response,
        duration_ms: mockAnswer.durationMs,
        error_code: null,
        error_message: null,
        twiml: plainTextVerbs,
      },
      verbs: plainTextVerbs,
      isSucceeded: true,
    };
  }
  if (!twimlContentTypes.includes(mediaType)) {
    return failWith("12300", `Invalid Content-Type: ${mockAnswer.contentType}`);
  }
  const parsedTwiml = parseTwiml(mockAnswer.body);
  if (!parsedTwiml.isValid) {
    return failWith("12100", "Document parse failure");
  }

  return {
    attempt: {
      ...baseAttempt,
      response,
      duration_ms: mockAnswer.durationMs,
      error_code: null,
      error_message: null,
      twiml: parsedTwiml.verbs,
    },
    verbs: parsedTwiml.verbs,
    isSucceeded: true,
  };
}
