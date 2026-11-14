import { describe, expect, test } from "vitest";

import { buildResponseSubject } from "@/lib/email/build-response-subject";

describe("buildResponseSubject", () => {
  test("adds Re: to a reply and Fwd: to a forward", () => {
    expect(buildResponseSubject("Your invoice", "reply")).toBe(
      "Re: Your invoice",
    );
    expect(buildResponseSubject("Your invoice", "forward")).toBe(
      "Fwd: Your invoice",
    );
  });

  test("does not double a prefix that is already there", () => {
    expect(buildResponseSubject("RE: Your invoice", "reply")).toBe(
      "RE: Your invoice",
    );
    expect(buildResponseSubject("Fw: Your invoice", "forward")).toBe(
      "Fw: Your invoice",
    );
  });

  test("keeps a reply prefix when forwarding a reply", () => {
    expect(buildResponseSubject("Re: Your invoice", "forward")).toBe(
      "Fwd: Re: Your invoice",
    );
  });

  test("an empty subject becomes just the prefix", () => {
    expect(buildResponseSubject("", "reply")).toBe("Re:");
  });
});
