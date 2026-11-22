/** Hex digits from a cryptographically secure source, for mock tokens and SIDs. */
export function createSecureRandomHex(digitCount: number): string {
  const randomBytes = crypto.getRandomValues(
    new Uint8Array(Math.ceil(digitCount / 2)),
  );
  return Array.from(randomBytes, (randomByte) =>
    randomByte.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, digitCount);
}
