import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { FormFieldError } from "@/components/common/form-field-error";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { paymentCurrencies } from "@/features/payments/payment-filters";
import { PaymentTestValuesCard } from "@/features/settings/payments/payment-test-values-card";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import type { AppSettings, PaymentOutcomeProfile } from "@/lib/api/types";

const paymentKeys = [
  "payment_merchant_name",
  "payment_default_currency",
  "payment_outcome_profile",
  "payment_random_success_rate_percent",
] as const;

const outcomeProfileOptions: {
  value: PaymentOutcomeProfile;
  label: string;
  description: string;
}[] = [
  {
    value: "interactive",
    label: "Interactive",
    description: "Each checkout waits for you on its checkout page.",
  },
  {
    value: "auto_success",
    label: "Always succeed",
    description:
      "New checkouts are paid at once, with their redirect and notifications.",
  },
  {
    value: "auto_decline",
    label: "Always decline",
    description: "New checkouts are declined at once (generic decline).",
  },
  {
    value: "random",
    label: "Random",
    description: "New checkouts succeed at the rate below, else are declined.",
  },
];

/** Merchant name, default currency, the outcome profile and the test values (PY-09.4). */
export function PaymentsSection({ appSettings }: { appSettings: AppSettings }) {
  const fieldIdPrefix = React.useId();
  const sectionForm = useSettingsSectionForm(appSettings, paymentKeys);
  const { draftValues, updateDraft, fieldErrors } = sectionForm;

  return (
    <div className="grid gap-4">
      <SettingsSectionCard
        title="Checkout"
        description="Applies to the next hosted checkout."
        isDirty={sectionForm.isDirty}
        isSaving={sectionForm.isSaving}
        onSave={sectionForm.saveChanges}
        onDiscard={sectionForm.discardChanges}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Merchant name"
            fieldId={`${fieldIdPrefix}-merchant`}
            hint="Shown on checkout pages and as {merchant} in flow labels."
            errorMessage={fieldErrors.payment_merchant_name}
          >
            <Input
              id={`${fieldIdPrefix}-merchant`}
              value={draftValues.payment_merchant_name}
              aria-invalid={fieldErrors.payment_merchant_name !== undefined}
              onChange={(changeEvent) =>
                updateDraft({ payment_merchant_name: changeEvent.target.value })
              }
            />
          </FormField>
          <FormField
            label="Default currency"
            fieldId={`${fieldIdPrefix}-currency`}
            hint="For checkouts created without a currency."
            errorMessage={fieldErrors.payment_default_currency}
          >
            <Select
              value={draftValues.payment_default_currency}
              onValueChange={(currency) =>
                updateDraft({ payment_default_currency: currency })
              }
            >
              <SelectTrigger
                id={`${fieldIdPrefix}-currency`}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentCurrencies.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <RadioCardGroup
          legend="Automatic outcome"
          className="sm:grid-cols-2"
          options={outcomeProfileOptions}
          selectedValue={draftValues.payment_outcome_profile}
          onSelect={(outcomeProfile) =>
            updateDraft({ payment_outcome_profile: outcomeProfile })
          }
        />
        {draftValues.payment_outcome_profile === "random" && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label id={`${fieldIdPrefix}-rate-label`}>Success rate</Label>
              <span className="text-sm tabular-nums">
                {draftValues.payment_random_success_rate_percent}%
              </span>
            </div>
            <Slider
              aria-labelledby={`${fieldIdPrefix}-rate-label`}
              min={0}
              max={100}
              step={1}
              value={[draftValues.payment_random_success_rate_percent]}
              onValueChange={([successRate]) =>
                updateDraft({
                  payment_random_success_rate_percent: successRate ?? 0,
                })
              }
            />
            <FormFieldError
              errorMessage={fieldErrors.payment_random_success_rate_percent}
            />
          </div>
        )}
      </SettingsSectionCard>
      <PaymentTestValuesCard />
    </div>
  );
}
