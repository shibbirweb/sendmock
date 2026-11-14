"use client";

import { useDemoBridge } from "@/lib/playground/demo-bridge-provider";

/** Events the mock API published since `sinceMs` (all of them when null). */
export function EventStreamPanel({ sinceMs }: { sinceMs: number | null }) {
  const { events } = useDemoBridge();
  const visibleEvents = events.filter(
    (playgroundEvent) =>
      sinceMs === null ||
      Date.parse(playgroundEvent.created_at) >= sinceMs - 1000,
  );

  return (
    <section aria-label="Event stream" className="grid gap-2">
      <h4 className="text-xs font-medium">Events</h4>
      {visibleEvents.length === 0 ? (
        <p className="text-xs text-fd-muted-foreground">
          No events yet. Events your request triggers (email.received, sms.sent,
          ...) appear here.
        </p>
      ) : (
        <ul data-testid="event-stream" className="grid gap-1">
          {visibleEvents.map((playgroundEvent) => (
            <li
              key={playgroundEvent.id}
              className="flex gap-2 font-mono text-xs"
            >
              <span className="text-fd-muted-foreground">
                {new Date(playgroundEvent.created_at).toLocaleTimeString()}
              </span>
              <span>{playgroundEvent.type}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
