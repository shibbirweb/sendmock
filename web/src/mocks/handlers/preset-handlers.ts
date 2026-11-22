import { http, HttpResponse } from "msw";

import type {
  PresetApplyInput,
  PresetApplyResult,
  StackPreset,
} from "@/lib/api/types";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

const laravelMailgunTwilio: StackPreset = {
  name: "laravel-mailgun-twilio",
  description:
    "A Laravel app sending email through Mailgun and SMS through Twilio: Mailgun's event and inbound webhooks, Twilio's test sender with the app's inbound and status URLs, the Debugger URL and a Mailgun signing key.",
  options: [
    ["mailgun_events_path", "/webhooks/mailgun/events"],
    ["mailgun_inbound_path", "/webhooks/mailgun/inbound"],
    ["twilio_inbound_path", "/webhooks/twilio/inbound"],
    ["twilio_status_path", "/webhooks/twilio/status"],
    ["twilio_debugger_path", "/webhooks/twilio/debugger"],
  ].map(([name, defaultValue]) => ({
    name: name ?? "",
    default_value: defaultValue ?? "",
    description: "One of the app's webhook paths.",
  })),
};

/** Stack presets: the demo lists the preset and answers an apply as the server would (PL-27). */
export const presetHandlers = [
  http.get("*/api/v1/presets", async () => {
    await applyMockConditions();

    return HttpResponse.json([laravelMailgunTwilio]);
  }),

  http.post(
    "*/api/v1/presets/:presetName/apply",
    async ({ params, request }) => {
      await applyMockConditions();
      if (params.presetName !== laravelMailgunTwilio.name) {
        return createNotFoundResponse("Preset");
      }
      const presetInput = (await request.json()) as PresetApplyInput;
      const appUrl = presetInput.app_url.trim().replace(/\/+$/, "");
      if (!/^https?:\/\//.test(appUrl)) {
        return createErrorResponse(
          400,
          "validation_failed",
          "Enter your app's http:// or https:// URL",
        );
      }
      const presetResult: PresetApplyResult = {
        preset_name: laravelMailgunTwilio.name,
        applied: [
          { item_kind: "Webhook endpoint", item_count: 2 },
          { item_kind: "Webhook rule", item_count: 2 },
          { item_kind: "Number", item_count: 1 },
        ],
        steps: [
          "Kept the Mailgun signing key.",
          `Set the Twilio Debugger URL to ${appUrl}/webhooks/twilio/debugger.`,
        ],
        smtp_address: "127.0.0.1:1025",
        provider_address: "127.0.0.1:8026",
        provider_tls_address: null,
        warnings: [
          "Laravel's mailgun mailer only speaks HTTPS: start SendMock with --provider-tls-addr 127.0.0.1:8027 and run sendmock trust.",
        ],
        env_block: [
          "MAIL_MAILER=mailgun",
          "MAILGUN_DOMAIN=mg.example.test",
          "MAILGUN_SECRET=key-sendmock",
          "MAILGUN_ENDPOINT=127.0.0.1:8026",
          "MAILGUN_SCHEME=http",
          "MAILGUN_WEBHOOK_SIGNING_KEY=key-sendmock-demo",
          "TWILIO_ACCOUNT_SID=ACtest00000000000000000000000000",
          "TWILIO_AUTH_TOKEN=twilio-test-token",
          "TWILIO_FROM=+15005550006",
        ].join("\n"),
      };

      return HttpResponse.json(presetResult);
    },
  ),
];
