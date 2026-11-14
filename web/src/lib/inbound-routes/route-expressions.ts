import type { InboundRouteAction, InboundRouteFilter } from "@/lib/api/types";

/** Mailgun writes the regex as typed, escaping only quotes. */
function quote(text: string): string {
  return `"${text.replaceAll('"', '\\"')}"`;
}

/** A filter in Mailgun syntax (WH-12.7). */
export function toRouteExpression(routeFilter: InboundRouteFilter): string {
  if (routeFilter.kind === "match_recipient") {
    return `match_recipient(${quote(routeFilter.pattern)})`;
  }
  if (routeFilter.kind === "match_header") {
    return `match_header(${quote(routeFilter.header_name)}, ${quote(routeFilter.pattern)})`;
  }

  return "catch_all()";
}

/** An action in Mailgun syntax (WH-12.7). */
export function toActionExpression(routeAction: InboundRouteAction): string {
  if (routeAction.kind === "forward_url") {
    return `forward(${quote(routeAction.url)})`;
  }
  if (routeAction.kind === "forward_email") {
    return `forward(${quote(routeAction.address)})`;
  }
  if (routeAction.kind === "store") {
    return routeAction.notify_url === null || routeAction.notify_url === ""
      ? "store()"
      : `store(notify=${quote(routeAction.notify_url)})`;
  }

  return "stop()";
}
