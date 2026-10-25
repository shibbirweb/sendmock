import type {
  ApiRequestLogEntry,
  EmailDetail,
  SmsMessageDetail,
} from "@/lib/api/types";
import {
  createMockUlid,
  minutesAgo,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";

type ApiRequestSpec = Omit<
  ApiRequestLogEntry,
  "id" | "created_at" | "linked_message"
> & { minutesAgo: number };

const twilioMessagesPath =
  "/2010-04-01/Accounts/AC00000000000000000000000000000000/Messages.json";
const twilioHeaders = {
  authorization: "Basic ••••••••",
  "content-type": "application/x-www-form-urlencoded",
  "user-agent": "twilio-node/5.3.0",
};

const apiRequestSpecs: ApiRequestSpec[] = [
  {
    minutesAgo: 0.5,
    api: "twilio",
    method: "POST",
    path: twilioMessagesPath,
    request_headers: twilioHeaders,
    request_body:
      "To=%2B8801700000000&From=%2B15550001111&Body=Your+Acme+verification+code+is+482913.+It+expires+in+10+minutes.",
    response_status: 201,
    response_body:
      '{"sid":"SMa1b2c3d4e5f60718293a4b5c6d7e8f90","status":"queued","to":"+8801700000000","from":"+15550001111","num_segments":"1"}',
    duration_ms: 3,
  },
  {
    minutesAgo: 3,
    api: "sendgrid",
    method: "POST",
    path: "/v3/mail/send",
    request_headers: {
      authorization: "Bearer SG.••••••••",
      "content-type": "application/json",
    },
    request_body:
      '{"personalizations":[{"to":[{"email":"rahim@example.com"}]}],"from":{"email":"no-reply@acme.test"},"template_id":"d-4f2a","dynamic_template_data":{"name":"Rahim"}}',
    response_status: 202,
    response_body: "",
    duration_ms: 4,
  },
  {
    minutesAgo: 9,
    api: "vonage",
    method: "POST",
    path: "/sms/json",
    request_headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    request_body:
      "api_key=a1b2c3&api_secret=••••••••&to=14155550123&from=Acme&text=Acme+alert%3A+your+scheduled+export+finished.",
    response_status: 200,
    response_body:
      '{"message-count":"1","messages":[{"to":"14155550123","message-id":"0A0000000123ABCD1","status":"0"}]}',
    duration_ms: 2,
  },
  {
    minutesAgo: 11,
    api: "twilio",
    method: "POST",
    path: twilioMessagesPath,
    request_headers: twilioHeaders,
    request_body: "To=%2B15005550001&From=%2B15550001111&Body=Hello",
    response_status: 400,
    response_body:
      '{"code":21211,"message":"The \'To\' number +15005550001 is not a valid phone number.","more_info":"https://www.twilio.com/docs/errors/21211","status":400}',
    duration_ms: 1,
  },
  {
    minutesAgo: 15,
    api: "native",
    method: "POST",
    path: "/api/v1/sms",
    request_headers: { "content-type": "application/json" },
    request_body: '{"from":"+15550001111","body":"Hi"}',
    response_status: 400,
    response_body:
      '{"error":{"code":"validation_failed","message":"The to field is required"}}',
    duration_ms: 1,
  },
  {
    minutesAgo: 21,
    api: "twilio",
    method: "POST",
    path: twilioMessagesPath,
    request_headers: { ...twilioHeaders, authorization: "Basic ••••••••" },
    request_body: "To=%2B15550009999&From=%2B15550001111&Body=Test",
    response_status: 401,
    response_body:
      '{"code":20003,"message":"Authenticate","more_info":"https://www.twilio.com/docs/errors/20003","status":401}',
    duration_ms: 1,
  },
];

/**
 * The demo requests, plus `fillerRequestCount` older copies of them for the
 * large data set, so the paged log can be tried with thousands of rows.
 */
export function buildApiRequestLogFixtures(
  fillerRequestCount = 0,
): ApiRequestLogEntry[] {
  const fillerSpecs = Array.from(
    { length: fillerRequestCount },
    (_, fillerIndex): ApiRequestSpec => ({
      ...(apiRequestSpecs[fillerIndex % apiRequestSpecs.length] ??
        apiRequestSpecs[0]!),
      minutesAgo: 30 + fillerIndex * 2,
    }),
  );

  return [...apiRequestSpecs, ...fillerSpecs].map(
    ({ minutesAgo: requestMinutesAgo, ...requestFields }) => ({
      ...requestFields,
      id: createMockUlid(minutesAgoInMs(requestMinutesAgo)),
      linked_message: null,
      created_at: minutesAgo(requestMinutesAgo),
    }),
  );
}

/** Links accepted API requests to the SMS or email they created, both ways. */
export function linkApiRequestFixtures(
  apiRequestLog: ApiRequestLogEntry[],
  emails: EmailDetail[],
  smsMessages: SmsMessageDetail[],
) {
  for (const apiRequest of apiRequestLog) {
    if (apiRequest.response_status >= 300) {
      continue;
    }

    if (apiRequest.api === "sendgrid") {
      const sendgridEmail = emails.find((email) => email.source === "sendgrid");
      if (sendgridEmail !== undefined) {
        apiRequest.linked_message = {
          kind: "email",
          id: sendgridEmail.id,
          sms_thread_id: null,
        };
      }
      continue;
    }

    const smsMessage = smsMessages.find(
      (candidateMessage) =>
        candidateMessage.api === apiRequest.api &&
        candidateMessage.direction === "outbound" &&
        apiRequest.request_body.includes(
          encodeURIComponent(candidateMessage.to_number).replace("%2B", ""),
        ),
    );
    if (smsMessage !== undefined) {
      smsMessage.api_request_id = apiRequest.id;
      apiRequest.linked_message = {
        kind: "sms",
        id: smsMessage.id,
        sms_thread_id: `${smsMessage.from_number}|${smsMessage.to_number}`,
      };
    }
  }
}
