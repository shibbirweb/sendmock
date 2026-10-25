import { describe, expect, test } from "vitest";

import type { VirtualNumberInput } from "@/lib/api/types";
import { validateMessagingServiceInput } from "@/lib/numbers/validate-messaging-service";
import { validateVirtualNumberInput } from "@/lib/numbers/validate-virtual-number";

const validNumberInput: VirtualNumberInput = {
  number: "+15550009999",
  label: "Sales",
  channels: ["sms"],
  inbound_url: "http://localhost:8000/sms/inbound",
  inbound_method: "POST",
  inbound_fallback_url: null,
  inbound_template_id: "twilio.inbound_sms",
  status_callback_url: null,
  messaging_service_sid: null,
};

describe("validateVirtualNumberInput", () => {
  test("SM-12.3 accepts a valid E.164 number", () => {
    expect(validateVirtualNumberInput(validNumberInput, [])).toEqual({});
  });

  test("SM-12.3 rejects numbers that are not E.164", () => {
    for (const invalidNumber of ["15550009999", "+0123456789", "+1 555 000"]) {
      expect(
        validateVirtualNumberInput(
          { ...validNumberInput, number: invalidNumber },
          [],
        ).number,
      ).toBe("Use E.164, for example +15550001111");
    }
  });

  test("SM-12.3 rejects a number that is already registered", () => {
    expect(
      validateVirtualNumberInput(validNumberInput, ["+15550009999"]).number,
    ).toBe("This number is already registered");
  });

  test("SM-12.3 needs a channel and http(s) URLs", () => {
    const fieldErrors = validateVirtualNumberInput(
      {
        ...validNumberInput,
        channels: [],
        inbound_url: "ftp://example.com",
        status_callback_url: "not a url",
      },
      [],
    );

    expect(fieldErrors.channels).toBe("Pick at least one channel");
    expect(fieldErrors.inbound_url).toBe("Enter an http:// or https:// URL");
    expect(fieldErrors.status_callback_url).toBe(
      "Enter an http:// or https:// URL",
    );
  });
});

describe("validateMessagingServiceInput", () => {
  const validServiceInput = {
    friendly_name: "Acme notifications",
    number_ids: [],
    inbound_mode: "defer_to_sender" as const,
    inbound_url: null,
    inbound_fallback_url: null,
  };

  test("SM-03.4 accepts deferring to the sender without a URL", () => {
    expect(validateMessagingServiceInput(validServiceInput)).toEqual({});
  });

  test("SM-03.4 needs a request URL when inbound goes to a webhook", () => {
    expect(
      validateMessagingServiceInput({
        ...validServiceInput,
        inbound_mode: "webhook",
      }).inbound_url,
    ).toBe("Enter the request URL");
  });

  test("needs a name", () => {
    expect(
      validateMessagingServiceInput({
        ...validServiceInput,
        friendly_name: " ",
      }).friendly_name,
    ).toBe("Enter a name");
  });
});
