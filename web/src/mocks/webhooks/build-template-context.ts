import type {
  AppEventType,
  EmailDetail,
  SmsMessage,
  TemplateRenderRequest,
  WebhookTemplateSummary,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import type { TemplateContext } from "@/mocks/webhooks/render-template-text";

type ContextSubject = {
  eventType: AppEventType;
  data: Record<string, unknown>;
  label: string;
};

function toEmailData(email: EmailDetail): Record<string, unknown> {
  return {
    id: email.id,
    message_id: email.message_id,
    from: email.from,
    to: email.to,
    cc: email.cc,
    subject: email.subject,
    text_body: email.text_body,
    html_body: email.html_body,
    tags: email.tags,
    extracted: email.extracted,
  };
}

function toSmsData(smsMessage: SmsMessage): Record<string, unknown> {
  return {
    id: smsMessage.id,
    provider_id: smsMessage.provider_id,
    from_number: smsMessage.from_number,
    to_number: smsMessage.to_number,
    body: smsMessage.body,
    status: smsMessage.status,
    error_code: smsMessage.error_code,
    extracted: smsMessage.extracted,
  };
}

/** A fixed example for each kind of event, used when no message is picked. */
export function buildSampleSubject(eventType: AppEventType): ContextSubject {
  if (eventType.startsWith("sms.")) {
    return {
      eventType,
      label: "Built-in sample",
      data: {
        provider_id: "SM00000000000000000000000000000001",
        from_number: "+15550001111",
        to_number: "+14155550100",
        body: "Your Acme code is 482913",
        status: "delivered",
        error_code: null,
        extracted: { otp: ["482913"], links: [] },
      },
    };
  }
  if (eventType === "webhook.failed") {
    return {
      eventType,
      label: "Built-in sample",
      data: {
        endpoint_name: "Laravel inbound mail",
        error_message: "HTTP 500",
      },
    };
  }

  return {
    eventType,
    label: "Built-in sample",
    data: {
      message_id: "<sample@sendmock.local>",
      from: { name: "Acme App", address: "no-reply@acme.test" },
      to: [{ name: "", address: "you@example.com" }],
      cc: [],
      subject: "Your verification code",
      text_body: "Your verification code is 739104.",
      html_body: null,
      tags: [],
      extracted: { otp: ["739104"], links: [] },
    },
  };
}

function findContextSubject(
  mockDatabase: MockDatabase,
  webhookTemplate: WebhookTemplateSummary,
  renderRequest: TemplateRenderRequest,
): ContextSubject | null {
  if (renderRequest.email_id !== undefined) {
    const email = mockDatabase.emails.find(
      (existingEmail) => existingEmail.id === renderRequest.email_id,
    );
    return email === undefined
      ? null
      : {
          eventType: "email.received",
          data: toEmailData(email),
          label: email.subject || "(no subject)",
        };
  }
  if (renderRequest.sms_id !== undefined) {
    const smsMessage = mockDatabase.smsMessages.find(
      (existingMessage) => existingMessage.id === renderRequest.sms_id,
    );
    return smsMessage === undefined
      ? null
      : {
          eventType:
            smsMessage.direction === "inbound" ? "sms.inbound" : "sms.status",
          data: toSmsData(smsMessage),
          label: smsMessage.body,
        };
  }

  return buildSampleSubject(webhookTemplate.events[0] ?? "email.received");
}

/** What a template sees: event, data, global variables and the endpoint (WH-08.4). */
export function buildTemplateContext(
  mockDatabase: MockDatabase,
  webhookTemplate: WebhookTemplateSummary,
  renderRequest: TemplateRenderRequest,
): { templateContext: TemplateContext; renderedAgainst: string } | null {
  const contextSubject = findContextSubject(
    mockDatabase,
    webhookTemplate,
    renderRequest,
  );
  if (contextSubject === null) {
    return null;
  }

  const globalVariables = Object.fromEntries(
    mockDatabase.webhookVariables
      .filter((webhookVariable) => webhookVariable.scope === "global")
      .map((webhookVariable) => [webhookVariable.name, webhookVariable.value]),
  );

  return {
    renderedAgainst: contextSubject.label,
    templateContext: {
      event: {
        id: "evt_preview",
        type: contextSubject.eventType,
        created_at: new Date().toISOString(),
      },
      data: contextSubject.data,
      vars: globalVariables,
      endpoint: {
        name: "Preview",
        url: "http://localhost:8000/webhooks/preview",
      },
      delivery: {
        id: "01PREVIEWDELIVERY000000000",
        attempt: 1,
        trigger: "manual",
      },
      rule: { id: null, name: null },
      sendmock: { version: "0.0.0-dev", http_url: "http://127.0.0.1:8025" },
      request_id: "01PREVIEWREQUEST0000000000",
      body_fields: {},
    },
  };
}
