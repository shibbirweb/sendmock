import type { OpenEventRequest, OpenSource } from "@/lib/api/types";

/**
 * The body of an open: who opened it and, in a browser, its user agent for
 * the open history.
 */
export function buildOpenEventRequest(
  openSource: OpenSource,
): OpenEventRequest {
  const userAgent =
    typeof navigator === "undefined" ? "" : (navigator.userAgent ?? "");

  return userAgent === ""
    ? { source: openSource }
    : { source: openSource, user_agent: userAgent };
}
