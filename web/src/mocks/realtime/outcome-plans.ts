import type { EmailOutcomeKind, SmsOutcomeKind } from "@/lib/api/types";
import {
  resolveEmailOutcome,
  resolveSmsOutcome,
} from "@/lib/outcomes/resolve-outcome";
import { mockDatabase } from "@/mocks/db/mock-database";

export type SmsOutcomePlan = {
  outcome: SmsOutcomeKind;
  errorCode: string | null;
  delaySeconds: number | null;
  /** Shown in errors and timelines, e.g. "custom rule 2" or "magic number". */
  sourceLabel: string;
};

/** What the SendMock after-send magic numbers do (04-sms.md). */
const afterSendMagicOutcomes: Record<
  string,
  Omit<SmsOutcomePlan, "sourceLabel">
> = {
  "+15005550101": {
    outcome: "undelivered",
    errorCode: "30003",
    delaySeconds: null,
  },
  "+15005550102": {
    outcome: "undelivered",
    errorCode: "30006",
    delaySeconds: null,
  },
  "+15005550103": {
    outcome: "undelivered",
    errorCode: "30007",
    delaySeconds: null,
  },
  "+15005550104": { outcome: "failed", errorCode: "30008", delaySeconds: null },
  "+15005550105": {
    outcome: "delayed_delivery",
    errorCode: null,
    delaySeconds: 30,
  },
  "+15005550106": { outcome: "read", errorCode: null, delaySeconds: null },
};

function planForNumber(
  phoneNumber: string,
  matchField: "to" | "from",
): SmsOutcomePlan | null {
  const resolution = resolveSmsOutcome(
    phoneNumber,
    matchField,
    mockDatabase.smsOutcomeRules,
    mockDatabase.settings.is_magic_numbers_enabled,
  );
  if (resolution.source === "custom") {
    const outcomeRule = mockDatabase.smsOutcomeRules.find(
      (existingRule) => existingRule.id === resolution.ruleId,
    );

    return outcomeRule === undefined
      ? null
      : {
          outcome: outcomeRule.outcome,
          errorCode: outcomeRule.error_code,
          delaySeconds: outcomeRule.delay_seconds,
          sourceLabel: `custom rule ${outcomeRule.position}`,
        };
  }
  if (resolution.source === "magic") {
    const afterSendOutcome =
      afterSendMagicOutcomes[resolution.magicRow.trigger];
    // Twilio's own test numbers are refused on send with their error code.
    return {
      ...(afterSendOutcome ?? {
        outcome: "reject",
        errorCode: resolution.magicRow.code,
        delaySeconds: null,
      }),
      sourceLabel: "magic number",
    };
  }

  return null;
}

/** The outcome a native send gets from custom rules or magic numbers, if any (SM-07.8). */
export function planSmsOutcome(
  toNumber: string,
  fromNumber: string,
): SmsOutcomePlan | null {
  return planForNumber(toNumber, "to") ?? planForNumber(fromNumber, "from");
}

export type EmailOutcomePlan = {
  outcome: EmailOutcomeKind;
  smtpCode: string | null;
  recipientAddress: string;
  sourceLabel: string;
};

const magicAddressOutcomes: Record<string, EmailOutcomeKind> = {
  "email.delivered": "delivered",
  "Hard bounce": "hard_bounce",
  "email.deferred, then soft bounce": "soft_bounce",
  "Delivered, then email.complained": "complaint",
  "Delivered, then an out-of-office reply": "delivered",
  "Bounce with a suppression-list reason": "hard_bounce",
};

/** The first recipient that a custom rule or magic address decides (EM-10.5). */
export function planEmailOutcome(
  recipientAddresses: string[],
): EmailOutcomePlan | null {
  for (const recipientAddress of recipientAddresses) {
    const resolution = resolveEmailOutcome(
      recipientAddress,
      mockDatabase.emailOutcomeRules,
      mockDatabase.settings.is_magic_addresses_enabled,
    );
    if (resolution.source === "custom") {
      const outcomeRule = mockDatabase.emailOutcomeRules.find(
        (existingRule) => existingRule.id === resolution.ruleId,
      );
      if (outcomeRule !== undefined) {
        return {
          outcome: outcomeRule.outcome,
          smtpCode: outcomeRule.smtp_code,
          recipientAddress,
          sourceLabel: `custom rule ${outcomeRule.position}`,
        };
      }
    }
    if (resolution.source === "magic") {
      return {
        outcome:
          magicAddressOutcomes[resolution.magicRow.outcome] ?? "delivered",
        smtpCode: resolution.magicRow.code,
        recipientAddress,
        sourceLabel: "magic address",
      };
    }
  }

  return null;
}
