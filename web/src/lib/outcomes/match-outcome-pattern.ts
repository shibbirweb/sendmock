/**
 * True when a value matches an outcome rule pattern: exact, or with `*`
 * standing for any characters. Case does not matter (email addresses), and a
 * `whatsapp:` prefix on the value is ignored (numbers).
 */
export function matchesOutcomePattern(pattern: string, value: string): boolean {
  const comparedValue = value.replace(/^whatsapp:/i, "").trim();
  const escapedPattern = pattern
    .trim()
    .split("*")
    .map((patternPart) => patternPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");

  return new RegExp(`^${escapedPattern}$`, "i").test(comparedValue);
}
