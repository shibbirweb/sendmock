/**
 * "9:41" until a pending code expires, "1:02:05" past an hour, or null once
 * it has run out.
 */
export function formatExpiryCountdown(
  expiresAt: string,
  nowMs: number,
): string | null {
  const remainingSeconds = Math.ceil((Date.parse(expiresAt) - nowMs) / 1000);
  if (remainingSeconds <= 0) {
    return null;
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}
