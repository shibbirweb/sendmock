import type { InboundRouteInput } from "@/lib/api/types";
import { findPatternError } from "@/lib/inbound-routes/match-route-filter";

/** Errors by field: `priority`, `description`, `pattern`, `header_name`, `actions`, and `actions.<index>`. */
export type InboundRouteFieldErrors = Partial<Record<string, string>>;

function isWebUrl(urlText: string): boolean {
  try {
    const parsedUrl = new URL(urlText.replace(/\\g<\w+>/g, "x"));
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

/** Rules for a route, shared by the editor and the API (WH-12.7). */
export function validateInboundRoute(
  routeInput: InboundRouteInput,
): InboundRouteFieldErrors {
  const fieldErrors: InboundRouteFieldErrors = {};
  if (
    !Number.isInteger(routeInput.priority) ||
    routeInput.priority < 0 ||
    routeInput.priority > 32767
  ) {
    fieldErrors.priority = "Use a whole number from 0 to 32767";
  }
  if (routeInput.description.length > 200) {
    fieldErrors.description = "Use 200 characters at most";
  }
  if (routeInput.filter.kind !== "catch_all") {
    const patternError = findPatternError(routeInput.filter.pattern);
    if (patternError !== null) {
      fieldErrors.pattern = patternError;
    }
  }
  if (
    routeInput.filter.kind === "match_header" &&
    routeInput.filter.header_name.trim() === ""
  ) {
    fieldErrors.header_name = "Enter the header name, e.g. subject";
  }
  if (routeInput.actions.length === 0) {
    fieldErrors.actions = "Add at least one action";
  }
  routeInput.actions.forEach((routeAction, actionIndex) => {
    const actionKey = `actions.${actionIndex}`;
    if (routeAction.kind === "forward_url" && !isWebUrl(routeAction.url)) {
      fieldErrors[actionKey] = "Enter an http or https URL";
    }
    if (
      routeAction.kind === "forward_email" &&
      !/^[^\s@]+@[^\s@]+$/.test(routeAction.address)
    ) {
      fieldErrors[actionKey] = "Enter an email address";
    }
    if (
      routeAction.kind === "store" &&
      routeAction.notify_url !== null &&
      routeAction.notify_url !== "" &&
      !isWebUrl(routeAction.notify_url)
    ) {
      fieldErrors[actionKey] = "Enter an http or https URL, or leave it empty";
    }
  });

  return fieldErrors;
}
