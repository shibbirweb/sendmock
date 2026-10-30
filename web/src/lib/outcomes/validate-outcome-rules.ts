import type {
  EmailOutcomeRuleInput,
  SmsOutcomeRuleInput,
} from "@/lib/api/types";

export type SmsOutcomeRuleFieldErrors = Partial<
  Record<keyof SmsOutcomeRuleInput, string>
>;
export type EmailOutcomeRuleFieldErrors = Partial<
  Record<keyof EmailOutcomeRuleInput, string>
>;

const maxNoteLength = 120;
const maxDiagnosticLength = 200;
const outcomesNeedingCode = new Set(["reject", "undelivered", "failed"]);

/** Rules for a custom outcome number (SM-07.7), shared by the form and the API. */
export function validateSmsOutcomeRuleInput(
  ruleInput: SmsOutcomeRuleInput,
): SmsOutcomeRuleFieldErrors {
  const fieldErrors: SmsOutcomeRuleFieldErrors = {};

  if (
    !/^\+?[0-9*]+$/.test(ruleInput.pattern.trim()) ||
    !/[0-9]/.test(ruleInput.pattern)
  ) {
    fieldErrors.pattern =
      "Use a number like +15559990000, or * for any digits (+1555777*)";
  }
  if (
    outcomesNeedingCode.has(ruleInput.outcome) &&
    !/^\d{3,6}$/.test(ruleInput.error_code ?? "")
  ) {
    fieldErrors.error_code = "Enter the error code, for example 30007";
  }
  if (
    ruleInput.outcome === "delayed_delivery" &&
    !(
      Number.isInteger(ruleInput.delay_seconds) &&
      (ruleInput.delay_seconds ?? 0) >= 1 &&
      (ruleInput.delay_seconds ?? 0) <= 3600
    )
  ) {
    fieldErrors.delay_seconds = "Choose 1 to 3,600 seconds";
  }
  if (ruleInput.note.length > maxNoteLength) {
    fieldErrors.note = `Use at most ${maxNoteLength} characters`;
  }

  return fieldErrors;
}

/** Rules for a custom outcome address (EM-10.5), shared by the form and the API. */
export function validateEmailOutcomeRuleInput(
  ruleInput: EmailOutcomeRuleInput,
): EmailOutcomeRuleFieldErrors {
  const fieldErrors: EmailOutcomeRuleFieldErrors = {};
  const pattern = ruleInput.pattern.trim();

  if (!/^[^\s@]+@[^\s@]+$/.test(pattern)) {
    fieldErrors.pattern =
      "Use an address like qa@app.test, or * wildcards (*@bounce.qa.test)";
  }
  // A refusing reply: class 4 or 5, the same in the enhanced code.
  if (
    ruleInput.smtp_code !== null &&
    !/^([45])\d\d( \1\.\d{1,3}\.\d{1,3})?$/.test(ruleInput.smtp_code)
  ) {
    fieldErrors.smtp_code = "Use an SMTP reply like 550 or 550 5.1.1";
  }
  // The diagnostic goes into an SMTP reply line, so it must stay one short line.
  if (
    ruleInput.diagnostic !== null &&
    (/[\u0000-\u001f\u007f]/.test(ruleInput.diagnostic) ||
      ruleInput.diagnostic.length > maxDiagnosticLength)
  ) {
    fieldErrors.diagnostic = `Use one line of at most ${maxDiagnosticLength} characters`;
  }
  if (ruleInput.note.length > maxNoteLength) {
    fieldErrors.note = `Use at most ${maxNoteLength} characters`;
  }

  return fieldErrors;
}
