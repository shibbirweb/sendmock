import type { InboundRouteTestResult } from "@/lib/api/types";

/** Which of the last 50 incoming emails the filter takes, with their captured groups (WH-12.7). */
export function RouteMatchPreview({
  testResult,
}: {
  testResult: InboundRouteTestResult | undefined;
}) {
  if (testResult === undefined) {
    return (
      <p className="text-xs text-muted-foreground">
        Fix the pattern to see which emails match.
      </p>
    );
  }
  if (testResult.checked_count === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No incoming emails yet. Reply to or forward an email as its recipient in
        Mail to try this route.
      </p>
    );
  }

  return (
    <section aria-label="Match preview" className="grid gap-2">
      <p className="text-sm font-medium" data-testid="route-match-count">
        Matches {testResult.matches.length} of the last{" "}
        {testResult.checked_count} incoming emails
      </p>
      <ul className="grid gap-1.5">
        {testResult.matches.map((routeMatch) => (
          <li
            key={routeMatch.email_id}
            className="grid gap-0.5 rounded-md border p-2 text-xs"
          >
            <span className="font-medium">{routeMatch.subject}</span>
            <span className="text-muted-foreground">
              From {routeMatch.from} to {routeMatch.matched_value}
            </span>
            {Object.entries(routeMatch.captured_groups).map(
              ([groupName, groupValue]) => (
                <span key={groupName} className="font-mono">
                  {groupName} = {groupValue}
                </span>
              ),
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
