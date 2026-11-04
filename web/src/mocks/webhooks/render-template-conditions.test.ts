import { describe, expect, test } from "vitest";

import { templateDefinitions } from "@/mocks/fixtures/template-definitions";
import {
  renderTemplateText,
  type TemplateContext,
} from "@/mocks/webhooks/render-template-text";

const smsData = {
  provider_id: "SM00000000000000000000000000000001",
  from_number: "+15550001111",
  to_number: "+14155550100",
  body: "hello there",
  encoding: "GSM-7",
  status: "delivered",
  error_code: null,
  messaging_service_sid: null,
};

const smsContext: TemplateContext = {
  event: { type: "sms.status", created_at: "2026-01-01T09:05:07Z" },
  data: smsData,
  vars: {},
};

function renderBody(
  templateId: string,
  templateContext: TemplateContext,
): string {
  const bodyTemplate = templateDefinitions[templateId]?.body_template ?? "";
  const renderOutcome = renderTemplateText(bodyTemplate, templateContext);
  expect(renderOutcome.errors).toEqual([]);

  return renderOutcome.renderedText;
}

describe("template conditions and argument filters", () => {
  test("an if block renders its chosen branch, with else and comparisons", () => {
    expect(
      renderTemplateText(
        '{% if data.error_code %}E{% endif %}[{% if data.encoding == "UCS-2" %}unicode{% else %}text{% endif %}]{% if data.status != "failed" %}ok{% endif %}',
        smsContext,
      ),
    ).toMatchObject({ renderedText: "[text]ok", warnings: [], errors: [] });
  });

  test("replace, regex_extract and date take arguments", () => {
    expect(
      renderTemplateText(
        '{{ data.to_number | replace("+", "") }} {{ data.body | regex_extract("^[^ ]+") | upper }} {{ event.created_at | date("%y%m%d%H%M") }} {{ event.created_at | date("%Y-%m-%d %H:%M:%S") }}',
        smsContext,
      ),
    ).toMatchObject({
      renderedText: "14155550100 HELLO 2601010905 2026-01-01 09:05:07",
      errors: [],
    });
  });

  test("WH-06.1 a Twilio status callback names an error code only when there is one", () => {
    const deliveredForm = new URLSearchParams(
      renderBody("twilio.status_callback", smsContext),
    );
    const undeliveredForm = new URLSearchParams(
      renderBody("twilio.status_callback", {
        ...smsContext,
        data: {
          ...smsData,
          status: "undelivered",
          error_code: "30003",
          messaging_service_sid: "MG00000000000000000000000000000001",
        },
      }),
    );

    expect(deliveredForm.has("ErrorCode")).toBe(false);
    expect(deliveredForm.has("MessagingServiceSid")).toBe(false);
    expect(deliveredForm.get("ApiVersion")).toBe("2010-04-01");
    expect(undeliveredForm.get("ErrorCode")).toBe("30003");
    expect(undeliveredForm.get("MessagingServiceSid")).toBe(
      "MG00000000000000000000000000000001",
    );
  });

  test("WH-06.1 a Vonage delivery receipt writes numbers without a plus and Vonage's times", () => {
    const deliveryReceipt = JSON.parse(
      renderBody("vonage.dlr", smsContext),
    ) as Record<string, string>;

    expect(deliveryReceipt).toMatchObject({
      msisdn: "14155550100",
      to: "15550001111",
      scts: "2601010905",
      "err-code": "0",
      "message-timestamp": "2026-01-01 09:05:07",
    });
  });
});
