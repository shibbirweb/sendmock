export function formatPercent(rate: number | null): string {
  return rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
}

export function formatLatencyMs(latencyMs: number | null): string {
  return latencyMs === null ? "n/a" : `${latencyMs} ms`;
}
