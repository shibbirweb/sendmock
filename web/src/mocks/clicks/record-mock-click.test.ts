import { describe, expect, test } from "vitest";

import type { EmailClickRecord, EmailDetail } from "@/lib/api/types";
import {
  describeMockClick,
  isEmailLink,
  recordMockClick,
} from "@/mocks/clicks/record-mock-click";

const verifyLink = "https://app.test/verify?token=abc123";
const helpLink = "https://app.test/help";

function buildEmailWithLinks(): EmailDetail {
  return {
    id: "01EMAIL",
    message_id: "<welcome@app.test>",
    to: [{ name: "", address: "sam@example.test" }],
    subject: "Verify your email",
    click_count: 0,
    extracted: { otp: [], links: [verifyLink, helpLink] },
  } as unknown as EmailDetail;
}

describe("recordMockClick", () => {
  test("EM-20.3 each click counts, newest first, and the first click per link is marked", () => {
    const email = buildEmailWithLinks();
    const emailClicks = new Map<string, EmailClickRecord[]>();

    const firstClick = recordMockClick(
      email,
      { url: verifyLink, source: "ui" },
      emailClicks,
    );
    const repeatedClick = recordMockClick(
      email,
      { url: verifyLink },
      emailClicks,
    );
    const otherLinkClick = recordMockClick(
      email,
      { url: helpLink },
      emailClicks,
    );

    expect(firstClick.isFirstClick).toBe(true);
    expect(repeatedClick.isFirstClick).toBe(false);
    expect(otherLinkClick.isFirstClick).toBe(true);
    expect(email.click_count).toBe(3);
    expect(
      emailClicks.get("01EMAIL")?.map((clickRecord) => clickRecord.url),
    ).toEqual([helpLink, verifyLink, verifyLink]);
    expect(repeatedClick.clickRecord.source).toBe("api");
  });

  test("EM-20.2 only the email's own links can be clicked", () => {
    const email = buildEmailWithLinks();

    expect(isEmailLink(email, verifyLink)).toBe(true);
    expect(isEmailLink(email, "https://elsewhere.test/")).toBe(false);
  });

  test("EM-20.3 the event carries the link, the counts, the source and the user agent", () => {
    const email = buildEmailWithLinks();
    const recordedClick = recordMockClick(
      email,
      { url: verifyLink, source: "manual", user_agent: " Test agent " },
      new Map(),
    );

    expect(describeMockClick(email, recordedClick)).toMatchObject({
      id: "01EMAIL",
      subject: "Verify your email",
      url: verifyLink,
      first_click: true,
      click_count: 1,
      source: "manual",
      user_agent: "Test agent",
    });
  });
});
