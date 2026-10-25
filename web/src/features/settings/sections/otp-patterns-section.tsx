import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import type { AppSettings } from "@/lib/api/types";
import { defaultOtpPatterns } from "@/lib/settings/default-otp-patterns";
import { compileOtpPattern, findOtpMatch } from "@/lib/settings/find-otp-match";

const otpKeys = ["otp_patterns"] as const;
const sampleMessage =
  "Your Acme verification code is 482913. It expires in 10 minutes.";

/** Paste a message and see which pattern finds which code (EM-05.5). */
function OtpPatternTester({ otpPatterns }: { otpPatterns: string[] }) {
  const testerId = React.useId();
  const [testMessage, setTestMessage] = React.useState(sampleMessage);
  const otpMatch = findOtpMatch(otpPatterns, testMessage);

  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <Label htmlFor={testerId}>Try a message</Label>
      <Textarea
        id={testerId}
        rows={3}
        value={testMessage}
        onChange={(changeEvent) => {
          setTestMessage(changeEvent.target.value);
        }}
      />
      <p aria-live="polite" className="text-sm">
        {otpMatch === null ? (
          <span className="text-muted-foreground">No code found.</span>
        ) : (
          <>
            Pattern {otpMatch.patternIndex + 1} found{" "}
            <span
              data-testid="otp-tester-code"
              className="rounded bg-background px-1.5 font-mono font-semibold tracking-widest"
            >
              {otpMatch.code}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/** Ordered OTP patterns with a live tester (EM-05.3, EM-05.5). */
export function OtpPatternsSection({
  appSettings,
}: {
  appSettings: AppSettings;
}) {
  const sectionForm = useSettingsSectionForm(appSettings, otpKeys);
  const { draftValues, updateDraft, fieldErrors } = sectionForm;
  const otpPatterns = draftValues.otp_patterns;

  const replacePattern = (patternIndex: number, nextPattern: string) => {
    updateDraft({
      otp_patterns: otpPatterns.map((existingPattern, existingIndex) =>
        existingIndex === patternIndex ? nextPattern : existingPattern,
      ),
    });
  };

  return (
    <SettingsSectionCard
      title="OTP patterns"
      description="Tried in order on every new email and SMS; the first capture group of the first match is the code."
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <ol aria-label="OTP patterns" className="grid gap-2">
        {otpPatterns.map((otpPattern, patternIndex) => {
          const isInvalid = compileOtpPattern(otpPattern) === null;

          return (
            <li key={patternIndex} className="flex items-center gap-2">
              <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">
                {patternIndex + 1}
              </span>
              <Input
                aria-label={`Pattern ${patternIndex + 1}`}
                className="font-mono text-xs"
                value={otpPattern}
                aria-invalid={isInvalid}
                onChange={(changeEvent) => {
                  replacePattern(patternIndex, changeEvent.target.value);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove pattern ${patternIndex + 1}`}
                onClick={() => {
                  updateDraft({
                    otp_patterns: otpPatterns.filter(
                      (_, existingIndex) => existingIndex !== patternIndex,
                    ),
                  });
                }}
              >
                <Trash2Icon />
              </Button>
            </li>
          );
        })}
      </ol>
      <FormFieldError errorMessage={fieldErrors.otp_patterns} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            updateDraft({ otp_patterns: [...otpPatterns, "(\\d{6})"] })
          }
        >
          <PlusIcon />
          Add pattern
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => updateDraft({ otp_patterns: [...defaultOtpPatterns] })}
        >
          <RotateCcwIcon />
          Restore defaults
        </Button>
      </div>
      <OtpPatternTester otpPatterns={otpPatterns} />
    </SettingsSectionCard>
  );
}
