import { describe, expect, test } from "vitest";

import {
  findFieldMappingDuplicate,
  findPathProblem,
  findTwilioAccountProblem,
  validateNewProvider,
} from "@/lib/providers/validate-message-provider";

describe("provider rules", () => {
  test("EM-18.4 a new provider needs a free, well-formed key that is not native", () => {
    const existingProviders = [{ key: "sendgrid" }];

    expect(validateNewProvider("acme_mail", "Acme", existingProviders)).toEqual(
      {},
    );
    expect(
      validateNewProvider("sendgrid", "Again", existingProviders).key,
    ).toContain("already exists");
    expect(
      validateNewProvider("native", "Native", existingProviders).key,
    ).toContain("SendMock's own API");
    expect(validateNewProvider("Bad Key", "", existingProviders)).toEqual({
      key: "Use 2 to 32 lowercase letters, digits or _, starting with a letter",
      name: "Enter a name",
    });
  });

  test("EM-24.2 a part may have several sources but not the same source twice", () => {
    const mailgunVariableMappings = [
      { part: "user_variables", source: "h:X-Mailgun-Variables" },
      { part: "user_variables", source: "v:*" },
    ];

    expect(findFieldMappingDuplicate(mailgunVariableMappings)).toBeUndefined();
    expect(
      findFieldMappingDuplicate([
        ...mailgunVariableMappings,
        { part: "user_variables", source: " v:* " },
      ]),
    ).toBe("user_variables is mapped from v:* twice");
  });

  test("SM-22.8 the Twilio account_sid must be AC and 32 letters or digits", () => {
    const twilioWith = (accountSid: string) => ({
      key: "twilio",
      credentials: [
        { name: "account_sid", value: accountSid, is_secret: false },
      ],
    });

    expect(
      findTwilioAccountProblem(
        twilioWith("ACtest0000000000000000000000000000"),
      ),
    ).toBeUndefined();
    expect(findTwilioAccountProblem(twilioWith(""))).toContain("AC and 32");
    expect(findTwilioAccountProblem(twilioWith("AC123"))).toContain(
      "AC and 32",
    );
    expect(
      findTwilioAccountProblem({ ...twilioWith(""), key: "vonage" }),
    ).toBeUndefined();
  });

  test("SM-16.4 a path must start with / and stay out of SendMock's own paths", () => {
    expect(findPathProblem("/v1/messages")).toBeUndefined();
    expect(findPathProblem("v1/messages")).toContain("must start with /");
    expect(findPathProblem("/api/v1/sms")).toContain("SendMock's own path");
    expect(findPathProblem("/v3/{domain/messages")).toContain("unfinished");
  });
});
