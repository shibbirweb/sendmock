import type { RetryPolicy } from "@/lib/api/types";

/**
 * When each attempt starts, in seconds after the first one: the delays are
 * used in order and the last one repeats (WH-01.5).
 */
export function buildAttemptSchedule(retryPolicy: RetryPolicy): number[] {
  const attemptStartsSeconds = [0];
  const lastDelaySeconds = retryPolicy.backoff_seconds.at(-1) ?? 0;

  for (
    let retryIndex = 0;
    retryIndex < retryPolicy.max_attempts - 1;
    retryIndex += 1
  ) {
    const delaySeconds =
      retryPolicy.backoff_seconds[retryIndex] ?? lastDelaySeconds;
    attemptStartsSeconds.push(
      (attemptStartsSeconds.at(-1) ?? 0) + delaySeconds,
    );
  }

  return attemptStartsSeconds;
}

/** 0 -> "0 s", 156 -> "2 m 36 s", 7260 -> "2 h 1 m". */
export function formatScheduleSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds} s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} m` : `${hours} h`;
  }

  return seconds > 0 ? `${minutes} m ${seconds} s` : `${minutes} m`;
}

const delayUnitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600 };

/** "30", "30s", "2m" or "1h" to seconds; null when it is not a delay. */
export function parseDelayText(delayText: string): number | null {
  const delayMatch = /^(\d+)\s*([smh]?)$/i.exec(delayText.trim());
  if (delayMatch === null) {
    return null;
  }

  const unitText = (delayMatch[2] ?? "").toLowerCase() || "s";

  return Number(delayMatch[1]) * (delayUnitSeconds[unitText] ?? 1);
}
