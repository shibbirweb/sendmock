import type { EmailOutcomeRule, SmsOutcomeRule } from "@/lib/api/types";
import {
  emailMagicAddresses,
  type MagicReferenceRow,
  sendmockAfterSendNumbers,
  twilioFromNumbers,
  twilioToNumbers,
} from "@/lib/outcomes/magic-reference-data";
import { matchesOutcomePattern } from "@/lib/outcomes/match-outcome-pattern";

/** Which source decides a message's outcome, for the testers and the mock. */
export type OutcomeResolution =
  | { source: "custom"; ruleId: string; rulePosition: number }
  | { source: "magic"; magicRow: MagicReferenceRow }
  | { source: "profile" };

function sortedEnabledRules<
  OutcomeRule extends { position: number; is_enabled: boolean },
>(outcomeRules: OutcomeRule[]): OutcomeRule[] {
  return outcomeRules
    .filter((outcomeRule) => outcomeRule.is_enabled)
    .toSorted(
      (firstRule, secondRule) => firstRule.position - secondRule.position,
    );
}

function findMagicNumber(
  matchField: "to" | "from",
  phoneNumber: string,
): MagicReferenceRow | null {
  const comparedNumber = phoneNumber.replace(/^whatsapp:/i, "");
  const magicRows =
    matchField === "to"
      ? [...twilioToNumbers, ...sendmockAfterSendNumbers]
      : twilioFromNumbers;

  return (
    magicRows.find((magicRow) => magicRow.trigger === comparedNumber) ?? null
  );
}

/**
 * Custom rules first (first enabled match wins), then the magic numbers
 * when they are on, then the simulation profile (SM-07.8, SM-07.9).
 */
export function resolveSmsOutcome(
  phoneNumber: string,
  matchField: "to" | "from",
  outcomeRules: SmsOutcomeRule[],
  isMagicNumbersEnabled: boolean,
): OutcomeResolution {
  const matchingRule = sortedEnabledRules(outcomeRules).find(
    (outcomeRule) =>
      outcomeRule.match_field === matchField &&
      matchesOutcomePattern(outcomeRule.pattern, phoneNumber),
  );
  if (matchingRule !== undefined) {
    return {
      source: "custom",
      ruleId: matchingRule.id,
      rulePosition: matchingRule.position,
    };
  }

  const magicRow = isMagicNumbersEnabled
    ? findMagicNumber(matchField, phoneNumber)
    : null;

  return magicRow === null
    ? { source: "profile" }
    : { source: "magic", magicRow };
}

/** `bounce+hard@<any>` style triggers to patterns, e.g. `bounce+hard@*`. */
function listMagicAddressPatterns(magicRow: MagicReferenceRow): string[] {
  return magicRow.trigger
    .split(",")
    .map((triggerText) => triggerText.trim().replace("<any>", "*"));
}

/** Custom address rules first, then the magic addresses, then the profile (EM-10.5, EM-10.6). */
export function resolveEmailOutcome(
  emailAddress: string,
  outcomeRules: EmailOutcomeRule[],
  isMagicAddressesEnabled: boolean,
): OutcomeResolution {
  const matchingRule = sortedEnabledRules(outcomeRules).find((outcomeRule) =>
    matchesOutcomePattern(outcomeRule.pattern, emailAddress),
  );
  if (matchingRule !== undefined) {
    return {
      source: "custom",
      ruleId: matchingRule.id,
      rulePosition: matchingRule.position,
    };
  }

  const magicRow = isMagicAddressesEnabled
    ? emailMagicAddresses.find((magicAddressRow) =>
        listMagicAddressPatterns(magicAddressRow).some((addressPattern) =>
          matchesOutcomePattern(addressPattern, emailAddress),
        ),
      )
    : undefined;

  return magicRow === undefined
    ? { source: "profile" }
    : { source: "magic", magicRow };
}
