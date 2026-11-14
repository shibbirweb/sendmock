import { describe, expect, test } from "vitest";

import { templateDefinitions } from "@/mocks/fixtures/template-definitions";
import { renderTemplateText } from "@/mocks/webhooks/render-template-text";

const clickedLink = "https://shop.test/verify?token=abc123";

const clickContext = {
  event: {
    id: "evt_01",
    type: "email.clicked",
    created_at: "2026-11-07T10:00:00Z",
  },
  data: {
    id: "01EMAIL",
    message_id: "<verify@shop.test>",
    from: { address: "no-reply@shop.test" },
    to: [{ address: "sam@example.test" }],
    subject: "Verify",
    url: clickedLink,
    clicked_at: "2026-11-07T10:00:00Z",
    user_agent: null,
  },
  vars: {},
};

function renderBody(templateId: string): unknown {
  const bodyTemplate = templateDefinitions[templateId]?.body_template ?? "";
  return JSON.parse(
    renderTemplateText(bodyTemplate, clickContext).renderedText,
  );
}

describe("click templates in the demo", () => {
  test("EM-20.5 SES sends a click as event publishing does, inside the SNS message", () => {
    const sesBody = renderBody("ses.sns") as { Message: string };
    const sesMessage = JSON.parse(sesBody.Message) as {
      eventType: string;
      click: { link: string; userAgent: string };
    };

    expect(sesMessage.eventType).toBe("Click");
    expect(sesMessage.click.link).toBe(clickedLink);
    expect(sesMessage.click.userAgent).toBe("");
  });

  test("EM-20.5 SparkPost sends a click as a track event with the link", () => {
    const sparkpostBody = renderBody("sparkpost.events") as {
      msys: { track_event: { type: string; target_link_url: string } };
    }[];

    expect(sparkpostBody[0]?.msys.track_event).toMatchObject({
      type: "click",
      target_link_url: clickedLink,
    });
  });
});
