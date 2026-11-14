/** The mock never waits longer than this, so the playground stays quick (docs/plan/06-api.md). */
export const mockWaitLimitMs = 3_000;
const pollIntervalMs = 150;

/** "10s", "500ms" or "2m" to milliseconds; a missing or bad value is 10 s. */
export function parseWaitTimeout(timeoutText: string | null): number {
  const timeoutMatch = /^(\d+)(ms|s|m)?$/.exec(timeoutText?.trim() ?? "");
  if (timeoutMatch === null) {
    return 10_000;
  }
  const amount = Number(timeoutMatch[1]);
  const unitMs =
    { ms: 1, s: 1_000, m: 60_000 }[timeoutMatch[2] ?? "s"] ?? 1_000;

  return Math.min(amount * unitMs, 60_000);
}

/** The time a wait starts matching from: `since`, else 30 s ago. */
export function readWaitSince(sinceText: string | null, nowMs: number): number {
  const sinceMs = sinceText === null ? Number.NaN : Date.parse(sinceText);

  return Number.isNaN(sinceMs) ? nowMs - 30_000 : sinceMs;
}

/** Polls until `findMatch` returns an item or the time runs out. */
export async function waitForMatch<MatchedItem>(
  findMatch: () => MatchedItem | undefined,
  timeoutMs: number,
): Promise<MatchedItem | undefined> {
  const deadlineMs = Date.now() + Math.min(timeoutMs, mockWaitLimitMs);
  for (;;) {
    const matchedItem = findMatch();
    if (matchedItem !== undefined || Date.now() >= deadlineMs) {
      return matchedItem;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
