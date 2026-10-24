import { describe, expect, test } from "vitest";

import { paginateItems } from "@/mocks/handlers/handler-utils";

const numberedItems = Array.from({ length: 120 }, (_, itemIndex) => itemIndex);

describe("paginateItems", () => {
  test("PL-01.2 returns the first page with a next cursor", () => {
    const firstPage = paginateItems(
      numberedItems,
      new URL("http://mss.test/api/v1/emails?limit=50"),
    );

    expect(firstPage.items).toHaveLength(50);
    expect(firstPage.next_cursor).toBe("50");
    expect(firstPage.total_count).toBe(120);
  });

  test("PL-01.2 the last page has no next cursor", () => {
    const lastPage = paginateItems(
      numberedItems,
      new URL("http://mss.test/api/v1/emails?limit=50&cursor=100"),
    );

    expect(lastPage.items).toEqual(numberedItems.slice(100));
    expect(lastPage.next_cursor).toBeNull();
  });

  test("an invalid limit falls back to the default page size", () => {
    const defaultPage = paginateItems(
      numberedItems,
      new URL("http://mss.test/api/v1/emails?limit=abc"),
    );

    expect(defaultPage.items).toHaveLength(50);
  });
});
