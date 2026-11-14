import { type InfiniteData, QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import {
  isEmailSummary,
  placeNewEmailsInLists,
} from "@/features/realtime/email-list-cache-patch";
import { queryKeys } from "@/lib/api/query-keys";
import type { EmailSummary, PageOf } from "@/lib/api/types";

type EmailPage = PageOf<EmailSummary>;

function buildEmailSummary(
  emailNumber: number,
  project: string = "default",
): EmailSummary {
  return {
    id: `email_${emailNumber}`,
    received_at: `2026-11-12T10:00:${String(emailNumber % 60).padStart(2, "0")}Z`,
    from: { name: "Shop", address: "shop@example.test" },
    to: [{ name: "Sam", address: "sam@example.test" }],
    subject: `Order ${emailNumber}`,
    snippet: "Thanks for your order",
    size_bytes: 1200,
    attachment_count: 0,
    is_read: false,
    tags: [],
    source: "smtp",
    delivery_status: null,
    open_count: 0,
    has_otp: false,
    direction: "outbound",
    response_kind: null,
    project,
  };
}

function buildPage(emailNumbers: number[], totalCount: number): EmailPage {
  return {
    items: emailNumbers.map((emailNumber) => buildEmailSummary(emailNumber)),
    next_cursor: emailNumbers.length > 0 ? "cursor" : null,
    total_count: totalCount,
  };
}

function readSubjects(emailPage: EmailPage | undefined): string[] {
  return emailPage?.items.map((email) => email.subject) ?? [];
}

describe("placeNewEmailsInLists", () => {
  test("PL-02.3 new emails go to the top of the scrolling list, newest first, with no request", () => {
    const queryClient = new QueryClient();
    const listKey = queryKeys.emails.infiniteList({ project: undefined });
    queryClient.setQueryData<InfiniteData<EmailPage>>(listKey, {
      pages: [buildPage([2, 1], 120), buildPage([0], 120)],
      pageParams: [undefined, "cursor"],
    });

    const listKeysToRefresh = placeNewEmailsInLists(queryClient, [
      buildEmailSummary(3),
      buildEmailSummary(4),
      buildEmailSummary(1),
    ]);

    const listData = queryClient.getQueryData<InfiniteData<EmailPage>>(listKey);
    expect(listKeysToRefresh).toEqual([]);
    expect(readSubjects(listData?.pages[0])).toEqual([
      "Order 4",
      "Order 3",
      "Order 2",
      "Order 1",
    ]);
    expect(listData?.pages[0]?.total_count).toBe(122);
    expect(listData?.pages[0]?.next_cursor).toBe("cursor");
    expect(readSubjects(listData?.pages[1])).toEqual(["Order 0"]);
  });

  test("PL-10.7 a list of one project leaves out another project's new email", () => {
    const queryClient = new QueryClient();
    const listKey = queryKeys.emails.infiniteList({ project: "billing" });
    queryClient.setQueryData<InfiniteData<EmailPage>>(listKey, {
      pages: [buildPage([], 0)],
      pageParams: [undefined],
    });

    placeNewEmailsInLists(queryClient, [
      buildEmailSummary(1, "default"),
      buildEmailSummary(2, "billing"),
    ]);

    const listData = queryClient.getQueryData<InfiniteData<EmailPage>>(listKey);
    expect(readSubjects(listData?.pages[0])).toEqual(["Order 2"]);
  });

  test("PL-02.3 a searched list is left to the server and named for a refresh", () => {
    const queryClient = new QueryClient();
    const searchedListKey = queryKeys.emails.infiniteList({ query: "invoice" });
    queryClient.setQueryData<InfiniteData<EmailPage>>(searchedListKey, {
      pages: [buildPage([1], 1)],
      pageParams: [undefined],
    });

    const listKeysToRefresh = placeNewEmailsInLists(queryClient, [
      buildEmailSummary(2),
    ]);

    expect(listKeysToRefresh).toEqual([searchedListKey]);
    expect(
      readSubjects(
        queryClient.getQueryData<InfiniteData<EmailPage>>(searchedListKey)
          ?.pages[0],
      ),
    ).toEqual(["Order 1"]);
  });

  test("PL-02.3 a one-page list with a limit keeps that many, newest first", () => {
    const queryClient = new QueryClient();
    const latestKey = queryKeys.emails.list({ limit: 3, project: undefined });
    queryClient.setQueryData<EmailPage>(latestKey, buildPage([2, 1, 0], 3));

    placeNewEmailsInLists(queryClient, [
      buildEmailSummary(3),
      buildEmailSummary(4),
    ]);

    const latestPage = queryClient.getQueryData<EmailPage>(latestKey);
    expect(readSubjects(latestPage)).toEqual(["Order 4", "Order 3", "Order 2"]);
    expect(latestPage?.total_count).toBe(5);
  });

  test("a one-page list without a limit is refreshed instead", () => {
    const queryClient = new QueryClient();
    const unlimitedKey = queryKeys.emails.list({});
    queryClient.setQueryData<EmailPage>(unlimitedKey, buildPage([1], 1));

    expect(placeNewEmailsInLists(queryClient, [buildEmailSummary(2)])).toEqual([
      unlimitedKey,
    ]);
  });
});

describe("isEmailSummary", () => {
  test("accepts a whole list row and refuses partial event data", () => {
    expect(isEmailSummary(buildEmailSummary(1))).toBe(true);
    expect(isEmailSummary({ id: "email_1", subject: "Hi" })).toBe(false);
    expect(isEmailSummary(null)).toBe(false);
  });
});
