import type { AppEvent } from "@/lib/api/types";

/** How often queued events are applied: four times a second, as Mailpit sends its stats. */
export const realtimeFlushIntervalMs = 250;

export type RealtimeEventBatcher = {
  addEvent: (appEvent: AppEvent) => void;
  /** Drops what is queued and stops the pending flush. */
  dispose: () => void;
};

/**
 * Applies the first event after a quiet moment at once, so a single email or SMS shows (and
 * toasts) as soon as it arrives, then hands over the events that follow together, oldest
 * first, once per interval: a burst of thousands becomes four flushes a second.
 */
export function createRealtimeEventBatcher(
  flushEvents: (queuedEvents: AppEvent[]) => void,
  flushIntervalMs: number = realtimeFlushIntervalMs,
): RealtimeEventBatcher {
  let queuedEvents: AppEvent[] = [];
  let intervalTimer: ReturnType<typeof setTimeout> | null = null;

  const startInterval = () => {
    intervalTimer = setTimeout(endInterval, flushIntervalMs);
  };

  function endInterval() {
    intervalTimer = null;
    if (queuedEvents.length === 0) {
      return;
    }
    const eventsToFlush = queuedEvents;
    queuedEvents = [];
    flushEvents(eventsToFlush);
    startInterval();
  }

  return {
    addEvent: (appEvent) => {
      if (intervalTimer === null) {
        flushEvents([appEvent]);
        startInterval();
        return;
      }
      queuedEvents.push(appEvent);
    },
    dispose: () => {
      if (intervalTimer !== null) {
        clearTimeout(intervalTimer);
        intervalTimer = null;
      }
      queuedEvents = [];
    },
  };
}
