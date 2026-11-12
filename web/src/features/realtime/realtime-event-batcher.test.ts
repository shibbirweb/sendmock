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

function readEventIds(flushedBatch: AppEvent[] | undefined): string[] {
  return flushedBatch?.map((appEvent) => appEvent.id) ?? [];
}

describe("createRealtimeEventBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("PL-02.3 the first event after a quiet moment is applied at once", () => {
    const flushedBatches: AppEvent[][] = [];
    const eventBatcher = createRealtimeEventBatcher((queuedEvents) => {
      flushedBatches.push(queuedEvents);
    });

    eventBatcher.addEvent(buildEmailEvent(1));
    expect(flushedBatches.map(readEventIds)).toEqual([["evt_1"]]);

    vi.advanceTimersByTime(realtimeFlushIntervalMs * 4);
    eventBatcher.addEvent(buildEmailEvent(2));
    expect(flushedBatches.map(readEventIds)).toEqual([["evt_1"], ["evt_2"]]);
  });

  test("PL-02.3 the rest of a burst is handed over in one flush, oldest first, after the interval", () => {
    const flushedBatches: AppEvent[][] = [];
    const eventBatcher = createRealtimeEventBatcher((queuedEvents) => {
      flushedBatches.push(queuedEvents);
    });

    for (let eventNumber = 1; eventNumber <= 1000; eventNumber += 1) {
      eventBatcher.addEvent(buildEmailEvent(eventNumber));
    }
    vi.advanceTimersByTime(realtimeFlushIntervalMs - 1);
    expect(flushedBatches).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(flushedBatches).toHaveLength(2);
    expect(flushedBatches[1]).toHaveLength(999);
    expect(flushedBatches[1]?.[0]?.id).toBe("evt_2");
    expect(flushedBatches[1]?.[998]?.id).toBe("evt_1000");
  });

  test("PL-02.3 a steady stream flushes at most four times in any second", () => {
    const flushTimesMs: number[] = [];
    const eventBatcher = createRealtimeEventBatcher(() => {
      flushTimesMs.push(Date.now());
    });

    for (let millisecond = 0; millisecond < 3000; millisecond += 1) {
      eventBatcher.addEvent(buildEmailEvent(millisecond));
      vi.advanceTimersByTime(1);
    }

    const busiestSecondFlushCount = Math.max(
      ...flushTimesMs.map(
        (flushTimeMs) =>
          flushTimesMs.filter(
            (otherTimeMs) =>
              otherTimeMs >= flushTimeMs && otherTimeMs < flushTimeMs + 1000,
          ).length,
      ),
    );
    expect(busiestSecondFlushCount).toBe(4);
  });

  test("dispose drops what is queued and stops the flush", () => {
    const flushEvents = vi.fn();
    const eventBatcher = createRealtimeEventBatcher(flushEvents);

    eventBatcher.addEvent(buildEmailEvent(1));
    eventBatcher.addEvent(buildEmailEvent(2));
    eventBatcher.dispose();
    vi.advanceTimersByTime(realtimeFlushIntervalMs * 4);

    expect(flushEvents).toHaveBeenCalledTimes(1);
  });
});
