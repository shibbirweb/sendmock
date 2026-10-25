/**
 * How the demo's pretend app answers reply webhooks (Stage A only; the real
 * server makes real requests). The fixtures' app runs at localhost:8000:
 * its `/sms/inbound` handler auto-replies with TwiML, its other handlers
 * answer an empty `<Response/>`, and paths ending in `/error` answer 500.
 * Any other host refuses the connection, so a fallback URL can be tried.
 */
export type MockAppAnswer =
  | {
      kind: "response";
      statusCode: number;
      contentType: string;
      body: string;
      durationMs: number;
    }
  | { kind: "connection_error"; message: string };

const mockAppHost = "localhost:8000";

export const autoReplyTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thanks! We got your message and will get back to you soon.</Message>
</Response>`;

const emptyTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response/>`;

export function answerMockAppRequest(requestUrl: string): MockAppAnswer {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return { kind: "connection_error", message: `Invalid URL: ${requestUrl}` };
  }
  if (parsedUrl.host !== mockAppHost) {
    return {
      kind: "connection_error",
      message: `Connection refused (${parsedUrl.host})`,
    };
  }
  if (parsedUrl.pathname.endsWith("/error")) {
    return {
      kind: "response",
      statusCode: 500,
      contentType: "text/html",
      body: "<h1>Server Error</h1>",
      durationMs: 42,
    };
  }

  return {
    kind: "response",
    statusCode: 200,
    contentType: "text/xml",
    body: parsedUrl.pathname.endsWith("/sms/inbound")
      ? autoReplyTwiml
      : emptyTwiml,
    durationMs: 38,
  };
}

/** The pretend app's answer to a forwarded email or notification: 200 at localhost:8000, else refused. */
export function answerMockAppPost(requestUrl: string): MockAppAnswer {
  const mockAnswer = answerMockAppRequest(requestUrl);

  return mockAnswer.kind === "connection_error" || mockAnswer.statusCode !== 200
    ? mockAnswer
    : {
        ...mockAnswer,
        contentType: "application/json",
        body: '{"received":true}',
      };
}
