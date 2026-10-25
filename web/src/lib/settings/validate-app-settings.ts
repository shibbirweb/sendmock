import type { AppSettings, AppSettingsUpdate } from "@/lib/api/types";
import { compileOtpPattern } from "@/lib/settings/find-otp-match";

export type AppSettingsFieldErrors = Partial<Record<keyof AppSettings, string>>;

export const chaosSmtpRejectCodes = [421, 450, 550, 552] as const;

function isWholeNumberBetween(value: unknown, min: number, max: number) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function checkRange(
  fieldErrors: AppSettingsFieldErrors,
  settingsUpdate: AppSettingsUpdate,
  fieldName: keyof AppSettings,
  [min, max]: [number, number],
  errorMessage: string,
) {
  const fieldValue = settingsUpdate[fieldName];
  if (fieldValue !== undefined && !isWholeNumberBetween(fieldValue, min, max)) {
    fieldErrors[fieldName] = errorMessage;
  }
}

function checkHostAndPort(address: string): boolean {
  const addressMatch = address.match(/^([\w.-]+):(\d{1,5})$/);
  const port = Number(addressMatch?.[2] ?? 0);

  return addressMatch !== null && port >= 1 && port <= 65_535;
}

function checkRelayUrl(relayUrl: string): boolean {
  try {
    const parsedUrl = new URL(relayUrl);

    return parsedUrl.protocol === "smtp:" || parsedUrl.protocol === "smtps:";
  } catch {
    return false;
  }
}

function findInvalidOtpPattern(otpPatterns: string[]): string | null {
  for (const [patternIndex, otpPattern] of otpPatterns.entries()) {
    const compiledPattern = compileOtpPattern(otpPattern);
    if (compiledPattern === null) {
      return `Pattern ${patternIndex + 1} is not a valid regular expression`;
    }
    if (!/\((?!\?)/.test(otpPattern)) {
      return `Pattern ${patternIndex + 1} needs a capture group around the code`;
    }
  }

  return null;
}

/**
 * Settings rules shared by the Settings forms and the API (PL-05.2). Only
 * the keys present in the update are checked.
 */
export function validateAppSettingsUpdate(
  settingsUpdate: AppSettingsUpdate,
): AppSettingsFieldErrors {
  const fieldErrors: AppSettingsFieldErrors = {};

  checkRange(
    fieldErrors,
    settingsUpdate,
    "max_emails",
    [1, 1_000_000],
    "Choose 1 to 1,000,000",
  );
  checkRange(
    fieldErrors,
    settingsUpdate,
    "max_sms",
    [1, 1_000_000],
    "Choose 1 to 1,000,000",
  );
  if (
    settingsUpdate.max_age_days !== undefined &&
    settingsUpdate.max_age_days !== null
  ) {
    checkRange(
      fieldErrors,
      settingsUpdate,
      "max_age_days",
      [1, 3650],
      "Choose 1 to 3,650 days",
    );
  }
  for (const percentField of [
    "email_outcome_bounce_rate_percent",
    "email_outcome_complaint_rate_percent",
    "sms_failure_rate_percent",
  ] as const) {
    checkRange(
      fieldErrors,
      settingsUpdate,
      percentField,
      [0, 100],
      "Choose 0 to 100%",
    );
  }
  checkRange(
    fieldErrors,
    settingsUpdate,
    "chaos_smtp_reject_next_count",
    [0, 1000],
    "Choose 0 to 1,000 messages",
  );
  checkRange(
    fieldErrors,
    settingsUpdate,
    "chaos_smtp_command_latency_ms",
    [0, 60_000],
    "Choose 0 to 60,000 ms",
  );

  if (
    settingsUpdate.chaos_smtp_reject_code !== undefined &&
    !chaosSmtpRejectCodes.includes(settingsUpdate.chaos_smtp_reject_code)
  ) {
    fieldErrors.chaos_smtp_reject_code = "Choose 421, 450, 550 or 552";
  }
  if (
    typeof settingsUpdate.relay_smtp_url === "string" &&
    !checkRelayUrl(settingsUpdate.relay_smtp_url)
  ) {
    fieldErrors.relay_smtp_url =
      "Use smtp://user:password@host:port or smtps://...";
  }
  if (
    settingsUpdate.relay_recipient_allowlist?.some(
      (allowedPattern) =>
        allowedPattern.trim() === "" || /\s/.test(allowedPattern),
    ) === true
  ) {
    fieldErrors.relay_recipient_allowlist =
      "Patterns cannot be empty or contain spaces";
  }
  if (
    typeof settingsUpdate.spamassassin_address === "string" &&
    !checkHostAndPort(settingsUpdate.spamassassin_address)
  ) {
    fieldErrors.spamassassin_address =
      "Use host:port, for example 127.0.0.1:783";
  }
  if (settingsUpdate.otp_patterns !== undefined) {
    const otpPatternError = findInvalidOtpPattern(settingsUpdate.otp_patterns);
    if (otpPatternError !== null) {
      fieldErrors.otp_patterns = otpPatternError;
    }
  }
  checkPaymentSettings(fieldErrors, settingsUpdate);

  return fieldErrors;
}

/** Settings > Payments (PY-09.4): a merchant name, an ISO 4217 code and a rate. */
function checkPaymentSettings(
  fieldErrors: AppSettingsFieldErrors,
  settingsUpdate: AppSettingsUpdate,
) {
  const merchantName = settingsUpdate.payment_merchant_name;
  if (
    merchantName !== undefined &&
    (merchantName.trim() === "" || merchantName.length > 60)
  ) {
    fieldErrors.payment_merchant_name = "Use 1 to 60 characters";
  }
  if (
    settingsUpdate.payment_default_currency !== undefined &&
    !/^[A-Z]{3}$/.test(settingsUpdate.payment_default_currency)
  ) {
    fieldErrors.payment_default_currency =
      "Use a 3-letter currency code, e.g. USD";
  }
  checkRange(
    fieldErrors,
    settingsUpdate,
    "payment_random_success_rate_percent",
    [0, 100],
    "Choose 0 to 100",
  );
}
