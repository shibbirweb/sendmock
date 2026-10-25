import { describe, expect, test } from "vitest";

import {
  parseMailSearch,
  toggleSearchToken,
} from "@/features/mail/parse-mail-search";

describe("parseMailSearch", () => {
  test("EM-03.4 understands every filter keyword", () => {
    expect(
      parseMailSearch(
        "from:acme to:rahim tag:billing is:unread has:attachment source:sendgrid",
      ),
    ).toEqual({
      from: "acme",
      to: "rahim",
      tag: "billing",
      is_unread: true,
      has_attachment: true,
      source: "sendgrid",
    });
  });

  test("EM-03.4 keeps free text as the full-text query", () => {
    expect(parseMailSearch("invoice  october is:unread")).toEqual({
      is_unread: true,
      query: "invoice october",
    });
  });

  test("unknown keywords and sources stay in the free-text query", () => {
    expect(parseMailSearch("size:big source:pigeon")).toEqual({
      query: "size:big source:pigeon",
    });
  });

  test("EM-17.3 is:inbound and is:outbound filter by direction", () => {
    expect(parseMailSearch("is:inbound password")).toEqual({
      direction: "inbound",
      query: "password",
    });
    expect(parseMailSearch("is:outbound")).toEqual({ direction: "outbound" });
  });

  test("an empty search means no filters", () => {
    expect(parseMailSearch("   ")).toEqual({});
  });
});

describe("toggleSearchToken", () => {
  test("adds a missing token and removes a present one", () => {
    expect(toggleSearchToken("invoice", "is:unread")).toBe("invoice is:unread");
    expect(toggleSearchToken("invoice is:unread", "is:unread")).toBe("invoice");
  });
});
