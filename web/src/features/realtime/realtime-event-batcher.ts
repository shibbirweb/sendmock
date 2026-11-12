import type { AppEvent } from "@/lib/api/types";

/** How often queued events are applied: four times a second, as Mailpit sends its stats. */
export const realtimeFlushIntervalMs = 250;

export type RealtimeEventBatcher = {
  addEvent: (appEvent: AppEvent) => void;
  /** Drops what is queued and stops the pending flush. */
  dispose: () => void;
};

/**
 * Queues realtime events and hands them over together, oldest first, once per interval, so
 * a burst of thousands of events becomes a few flushes instead of one UI update per event.
 */
export function createRealtimeEventBatcher(
  flushEvents: (queuedEvents: AppEvent[]) => void,
  flushIntervalMs: number = realtimeFlushIntervalMs,
): RealtimeEventBatcher {
  let queuedEvents: AppEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flushQueuedEvents = () => {
    flushTimer = null;
    const eventsToFlush = queuedEvents;
    queuedEvents = [];
    flushEvents(eventsToFlush);
  };

  return {
    addEvent: (appEvent) => {
      queuedEvents.push(appEvent);
      if (flushTimer === null) {
        flushTimer = setTimeout(flushQueuedEvents, flushIntervalMs);
      }
    },
    dispose: () => {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      queuedEvents = [];
    },
  };
}
