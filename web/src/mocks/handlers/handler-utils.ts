import { delay, HttpResponse } from "msw";

import type { ApiErrorBody, PageOf } from "@/lib/api/types";
import { readMockConditions } from "@/mocks/conditions/mock-conditions";

const defaultPageSize = 50;
const maximumPageSize = 500;

export function createErrorResponse(
  statusCode: number,
  errorCode: string,
  errorMessage: string,
) {
  const errorBody: ApiErrorBody = {
    error: { code: errorCode, message: errorMessage },
  };

  return HttpResponse.json(errorBody, { status: statusCode });
}

export function createNotFoundResponse(resourceName: string) {
  return createErrorResponse(404, "not_found", `${resourceName} not found`);
}

/**
 * Applies the dev toolbar conditions to every mock response: artificial
 * latency first, then a forced error when one is selected.
 */
export async function applyMockConditions(): Promise<Response | null> {
  const mockConditions = readMockConditions();

  if (mockConditions.latencyMs > 0) {
    await delay(mockConditions.latencyMs);
  }

  if (mockConditions.simulatedApiError === "server-error") {
    return createErrorResponse(500, "internal_error", "Simulated server error");
  }

  if (mockConditions.simulatedApiError === "not-found") {
    return createNotFoundResponse("Resource");
  }

  return null;
}

/** Cursor pagination over an in-memory list; the cursor is the next offset. */
export function paginateItems<ItemType>(
  allItems: ItemType[],
  requestUrl: URL,
): PageOf<ItemType> {
  const requestedLimit = Number(
    requestUrl.searchParams.get("limit") ?? defaultPageSize,
  );
  const pageSize = Math.min(
    Math.max(requestedLimit || defaultPageSize, 1),
    maximumPageSize,
  );
  const pageOffset = Number(requestUrl.searchParams.get("cursor") ?? 0) || 0;
  const pageItems = allItems.slice(pageOffset, pageOffset + pageSize);
  const nextOffset = pageOffset + pageItems.length;

  return {
    items: pageItems,
    next_cursor: nextOffset < allItems.length ? String(nextOffset) : null,
    total_count: allItems.length,
  };
}

/** Case-insensitive "contains" used by the mock search filters. */
export function includesText(
  searchedText: string | null | undefined,
  searchTerm: string,
): boolean {
  return (searchedText ?? "").toLowerCase().includes(searchTerm.toLowerCase());
}
