import type { OutcomeResolution } from "@/lib/outcomes/resolve-outcome";

/** "Custom rule 2: Undelivered, 30007", "Magic number: Invalid number (21211)", ... */
export function describeResolution(
  resolution: OutcomeResolution,
  describeCustomRule: (ruleId: string) => string,
  magicLabel: string,
  profileText: string,
): string {
  if (resolution.source === "custom") {
    return `Custom rule ${resolution.rulePosition}: ${describeCustomRule(resolution.ruleId)}`;
  }
  if (resolution.source === "magic") {
    const codeText =
      resolution.magicRow.code === null ? "" : ` (${resolution.magicRow.code})`;

    return `${magicLabel}: ${resolution.magicRow.outcome}${codeText}`;
  }

  return profileText;
}
