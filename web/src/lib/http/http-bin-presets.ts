import type { HttpBinPreset, HttpMockResponse } from "@/lib/api/types";

export type HttpBinPresetDefinition = {
  preset: HttpBinPreset;
  label: string;
  /** What the app points at the bin, shown as a hint. */
  description: string;
  defaultResponse: HttpMockResponse;
};

const jsonHeaders = { "content-type": "application/json" };

/** The reply of a bin without a preset (HC-02.1). */
export const plainDefaultResponse: HttpMockResponse = {
  status_code: 200,
  headers: jsonHeaders,
  body: '{"ok":true}',
};

/** Each preset's reply mimics the real service, so client libraries accept it (HC-03.1). */
export const httpBinPresets: HttpBinPresetDefinition[] = [
  {
    preset: "slack",
    label: "Slack incoming webhook",
    description: "POST with text or blocks; Slack answers 200 ok.",
    defaultResponse: {
      status_code: 200,
      headers: { "content-type": "text/plain" },
      body: "ok",
    },
  },
  {
    preset: "discord",
    label: "Discord webhook",
    description: "Content and embeds; Discord answers 204.",
    defaultResponse: { status_code: 204, headers: {}, body: "" },
  },
  {
    preset: "teams",
    label: "Microsoft Teams",
    description: "Card payloads; Teams answers 200 with 1.",
    defaultResponse: {
      status_code: 200,
      headers: { "content-type": "text/plain" },
      body: "1",
    },
  },
  {
    preset: "google_chat",
    label: "Google Chat",
    description: "Card or text messages; answers with the message.",
    defaultResponse: {
      status_code: 200,
      headers: jsonHeaders,
      body: '{"name":"spaces/AAAA/messages/{{ random_string(12) }}"}',
    },
  },
  {
    preset: "telegram",
    label: "Telegram Bot API",
    description: "/bot<token>/sendMessage and friends.",
    defaultResponse: {
      status_code: 200,
      headers: jsonHeaders,
      body: '{"ok":true,"result":{"message_id":{{ now_unix() }},"date":{{ now_unix() }}}}',
    },
  },
  {
    preset: "fcm",
    label: "Firebase Cloud Messaging v1",
    description: "/v1/projects/{project}/messages:send",
    defaultResponse: {
      status_code: 200,
      headers: jsonHeaders,
      body: '{"name":"projects/demo/messages/0:{{ now_unix() }}"}',
    },
  },
  {
    preset: "expo",
    label: "Expo push",
    description: "/--/api/v2/push/send; answers with tickets.",
    defaultResponse: {
      status_code: 200,
      headers: jsonHeaders,
      body: '{"data":[{"status":"ok","id":"{{ random_string(36) }}"}]}',
    },
  },
  {
    preset: "onesignal",
    label: "OneSignal",
    description: "/notifications; answers with an id and recipients.",
    defaultResponse: {
      status_code: 200,
      headers: jsonHeaders,
      body: '{"id":"{{ random_string(36) }}","recipients":1}',
    },
  },
  {
    preset: "generic",
    label: "Generic JSON API",
    description: "Anything; answers with a generated id.",
    defaultResponse: {
      status_code: 200,
      headers: jsonHeaders,
      body: '{"id":"{{ random_string(16) }}","received":true}',
    },
  },
];

export function findHttpBinPreset(
  preset: HttpBinPreset | null,
): HttpBinPresetDefinition | undefined {
  return httpBinPresets.find(
    (presetDefinition) => presetDefinition.preset === preset,
  );
}

/** The default reply a new bin starts with. */
export function readPresetDefaultResponse(
  preset: HttpBinPreset | null,
): HttpMockResponse {
  return findHttpBinPreset(preset)?.defaultResponse ?? plainDefaultResponse;
}
