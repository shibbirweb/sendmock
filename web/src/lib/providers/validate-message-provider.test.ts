import { describe, expect, test } from "vitest";

import {
  findPathProblem,
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

  test("SM-16.4 a path must start with / and stay out of SendMock's own paths", () => {
    expect(findPathProblem("/v1/messages")).toBeUndefined();
    expect(findPathProblem("v1/messages")).toContain("must start with /");
    expect(findPathProblem("/api/v1/sms")).toContain("SendMock's own path");
    expect(findPathProblem("/v3/{domain/messages")).toContain("unfinished");
  });
});
