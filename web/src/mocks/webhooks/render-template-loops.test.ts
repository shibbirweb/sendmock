import { describe, expect, test } from "vitest";

import { templateDefinitions } from "@/mocks/fixtures/template-definitions";
import {
  renderTemplateText,
  type TemplateContext,
} from "@/mocks/webhooks/render-template-text";

const inboundData = {
  provider_id: "SM00000000000000000000000000000001",
  channel: "sms",
  from_number: "+15550002222",
  to_number: "+15550001111",
  body: "look at this",
  segments: 1,
  media: [] as { content_type: string; url: string }[],
  messaging_service_sid: null,
};

function buildInboundContext(
  changedData: Partial<typeof inboundData>,
): TemplateContext {
  return {
    event: { type: "sms.inbound", created_at: "2026-01-01T09:05:07Z" },
    data: { ...inboundData, ...changedData },
    vars: {},
    sendmock: { version: "0.0.0", http_url: "http://127.0.0.1:8025" },
  };
}

function renderInboundForm(changedData: Partial<typeof inboundData>) {
  const bodyTemplate =
    templateDefinitions["twilio.inbound_sms"]?.body_template ?? "";
  const renderOutcome = renderTemplateText(
    bodyTemplate,
    buildInboundContext(changedData),
  );
  expect(renderOutcome.errors).toEqual([]);

  return new URLSearchParams(renderOutcome.renderedText);
}

describe("template loops and the Twilio inbound format", () => {
  test("a for block repeats its body per item with loop.index0 and loop.index", () => {
    expect(
      renderTemplateText(
        "{% for media_item in data.media %}[{{ loop.index0 }}/{{ loop.index }} {{ media_item.content_type }}]{% endfor %}{{ data.media | length }}",
        buildInboundContext({
          media: [
            { content_type: "image/png", url: "/a" },
            { content_type: "image/gif", url: "/b" },
          ],
        }),
      ),
    ).toMatchObject({
      renderedText: "[0/1 image/png][1/2 image/gif]2",
      warnings: [],
      errors: [],
    });
  });

  test("a for block over a missing list renders nothing", () => {
    expect(
      renderTemplateText(
        "a{% for item in data.missing %}{{ item }}{% endfor %}b",
        buildInboundContext({}),
      ).renderedText,
    ).toBe("ab");
  });

  test("SM-09.4 the Twilio inbound format numbers each media file with a link to SendMock's copy", () => {
    const inboundForm = renderInboundForm({
      media: [
        {
          content_type: "image/png",
          url: "/api/v1/sms/01SMS/media/0",
        },
      ],
    });

    expect(inboundForm.get("NumMedia")).toBe("1");
    expect(inboundForm.get("MediaContentType0")).toBe("image/png");
    expect(inboundForm.get("MediaUrl0")).toBe(
      "http://127.0.0.1:8025/api/v1/sms/01SMS/media/0",
    );
    expect(inboundForm.has("ProfileName")).toBe(false);
    expect(inboundForm.get("From")).toBe("+15550002222");
  });

  test("SM-09.4 a WhatsApp message adds the whatsapp: prefix, ProfileName and WaId", () => {
    const inboundForm = renderInboundForm({ channel: "whatsapp" });

    expect(inboundForm.get("From")).toBe("whatsapp:+15550002222");
    expect(inboundForm.get("To")).toBe("whatsapp:+15550001111");
    expect(inboundForm.get("WaId")).toBe("15550002222");
    expect(inboundForm.get("ProfileName")).toBe("WhatsApp user");
    expect(inboundForm.get("NumMedia")).toBe("0");
  });
});
