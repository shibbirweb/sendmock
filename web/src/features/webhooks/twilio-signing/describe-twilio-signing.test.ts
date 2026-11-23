import { describe, expect, test } from "vitest";

import {
  describeTwilioSigning,
  isTwilioSignedTemplate,
} from "@/features/webhooks/twilio-signing/describe-twilio-signing";
import type {
  MessageProviderDefinition,
  WebhookVariable,
} from "@/lib/api/types";

const twilioProvider = {
  key: "twilio",
  credentials: [
    {
      name: "account_sid",
      value: "ACtest0000000000000000000000000000",
      is_secret: false,
    },
  ],
} as unknown as MessageProviderDefinition;

function tokenVariable(scope: "global" | "endpoint"): WebhookVariable {
  return {
    name: "twilio_auth_token",
    scope,
  } as unknown as WebhookVariable;
}

describe("describeTwilioSigning", () => {
  test("SM-19.6 without a variable the Twilio provider's token for the event's account signs", () => {
    expect(describeTwilioSigning([], [twilioProvider])).toContain(
      "Twilio provider: the token of the event's subaccount, or of account ACtest0000000000000000000000000000 for any other.",
    );
  });

  test("SM-19.6 without a Twilio account SID the main account's token signs the rest", () => {
    expect(describeTwilioSigning([], [])).toContain(
      "the token of the event's subaccount, or of the main account for any other.",
    );
  });

  test("SM-19.6 a global twilio_auth_token variable wins and says so", () => {
    expect(
      describeTwilioSigning([tokenVariable("global")], [twilioProvider]),
    ).toBe(
      "Variable twilio_auth_token, which wins over the Twilio provider's token.",
    );
  });

  test("SM-19.6 only the two Twilio templates are signed this way", () => {
    expect(isTwilioSignedTemplate("twilio.status_callback")).toBe(true);
    expect(isTwilioSignedTemplate("twilio.inbound_sms")).toBe(true);
    expect(isTwilioSignedTemplate("stripe.event")).toBe(false);
  });
});
