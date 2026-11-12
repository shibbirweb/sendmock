import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createRealtimeEventBatcher,
  realtimeFlushIntervalMs,
} from "@/features/realtime/realtime-event-batcher";
import type { AppEvent } from "@/lib/api/types";

function buildEmailEvent(eventNumber: number): AppEvent {
  return {
    id: `evt_${eventNumber}`,
    type: "email.received",
    created_at: "2026-11-12T10:00:00Z",
    data: { id: `email_${eventNumber}` },
  };
}

describe("createRealtimeEventBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("PL-02.3 a burst of events is handed over in one flush, oldest first, after the interval", () => {
    const flushedBatches: AppEvent[][] = [];
    const eventBatcher = createRealtimeEventBatcher((queuedEvents) => {
      flushedBatches.push(queuedEvents);
    });

    for (let eventNumber = 1; eventNumber <= 1000; eventNumber += 1) {
      eventBatcher.addEvent(buildEmailEvent(eventNumber));
    }
    vi.advanceTimersByTime(realtimeFlushIntervalMs - 1);
    expect(flushedBatches).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(flushedBatches).toHaveLength(1);
    expect(flushedBatches[0]).toHaveLength(1000);
    expect(flushedBatches[0]?.[0]?.id).toBe("evt_1");
    expect(flushedBatches[0]?.[999]?.id).toBe("evt_1000");
  });

  test("PL-02.3 a steady stream flushes at most four times a second", () => {
    let flushCount = 0;
    const eventBatcher = createRealtimeEventBatcher(() => {
      flushCount += 1;
    });

    for (let millisecond = 0; millisecond < 1000; millisecond += 1) {
      eventBatcher.addEvent(buildEmailEvent(millisecond));
      vi.advanceTimersByTime(1);
    }

    expect(flushCount).toBe(4);
  });

  test("dispose drops what is queued and stops the flush", () => {
    const flushEvents = vi.fn();
    const eventBatcher = createRealtimeEventBatcher(flushEvents);

    eventBatcher.addEvent(buildEmailEvent(1));
    eventBatcher.dispose();
    vi.advanceTimersByTime(realtimeFlushIntervalMs * 4);

    expect(flushEvents).not.toHaveBeenCalled();
  });
});
