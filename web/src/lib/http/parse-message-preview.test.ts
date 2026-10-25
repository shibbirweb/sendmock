import { describe, expect, test } from "vitest";

import { parseMessagePreview } from "@/lib/http/parse-message-preview";
import { parseSlackMarkdown } from "@/lib/http/parse-slack-markdown";
import { buildTestCapturedRequest } from "@/lib/http/test-captured-request";

function previewBody(
  body: string,
  preset: Parameters<typeof parseMessagePreview>[1] = null,
) {
  return parseMessagePreview(buildTestCapturedRequest({ body }), preset);
}

describe("parseMessagePreview", () => {
  test("HC-03.2 reads Slack Block Kit", () => {
    expect(
      previewBody(
        JSON.stringify({
          blocks: [
            { type: "header", text: { type: "plain_text", text: "Deploy" } },
            {
              type: "section",
              text: { type: "mrkdwn", text: "*done*" },
              fields: [{ type: "mrkdwn", text: "a" }],
            },
            { type: "divider" },
            {
              type: "actions",
              elements: [
                { type: "button", text: { type: "plain_text", text: "Open" } },
              ],
            },
          ],
        }),
      ),
    ).toEqual({
      previewKind: "slack",
      text: null,
      blocks: [
        { blockKind: "header", text: "Deploy" },
        { blockKind: "section", text: "*done*", fields: ["a"] },
        { blockKind: "divider" },
        { blockKind: "actions", buttonLabels: ["Open"] },
      ],
    });
  });

  test("HC-03.2 reads Discord embeds with their colour", () => {
    const discordPreview = previewBody(
      JSON.stringify({
        content: "hi",
        embeds: [
          {
            title: "Live",
            color: 5763719,
            fields: [{ name: "Env", value: "prod", inline: true }],
          },
        ],
      }),
    );

    expect(discordPreview).toMatchObject({
      previewKind: "discord",
      content: "hi",
      embeds: [
        {
          title: "Live",
          colorHex: "#57f287",
          fields: [{ name: "Env", value: "prod", isInline: true }],
        },
      ],
    });
  });

  test("HC-03.2 reads FCM, Expo and OneSignal pushes", () => {
    expect(
      previewBody(
        '{"message":{"token":"t1","notification":{"title":"Hi","body":"There"}}}',
      ),
    ).toEqual({
      previewKind: "push",
      notifications: [
        { service: "FCM", title: "Hi", body: "There", target: "t1" },
      ],
    });
    expect(
      previewBody('[{"to":"ExponentPushToken[x]","title":"A","body":"B"}]')
        ?.previewKind,
    ).toBe("push");
    expect(
      previewBody(
        '{"headings":{"en":"Sale"},"contents":{"en":"Today"},"include_player_ids":["p1"]}',
      ),
    ).toMatchObject({
      notifications: [{ service: "OneSignal", title: "Sale", target: "p1" }],
    });
  });

  test("a generic payload has no preview unless the bin's preset says what it is", () => {
    expect(previewBody('{"event":"signup","text":"x"}')).toBeNull();
    expect(
      previewBody('{"event":"signup","text":"x"}', "slack")?.previewKind,
    ).toBe("slack");
    expect(previewBody("not json")).toBeNull();
  });
});

describe("parseSlackMarkdown", () => {
  test("HC-03.2 splits bold, italic, strike, code and links", () => {
    expect(parseSlackMarkdown("*a* _b_ ~c~ `d` <https://x.test|e> f")).toEqual([
      { segmentKind: "bold", text: "a" },
      { segmentKind: "text", text: " " },
      { segmentKind: "italic", text: "b" },
      { segmentKind: "text", text: " " },
      { segmentKind: "strike", text: "c" },
      { segmentKind: "text", text: " " },
      { segmentKind: "code", text: "d" },
      { segmentKind: "text", text: " " },
      { segmentKind: "link", text: "e", url: "https://x.test" },
      { segmentKind: "text", text: " f" },
    ]);
  });
});
