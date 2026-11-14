import type * as React from "react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Label } from "@/components/ui/label";

/** Label, control, optional hint and validation message, stacked. */
export function FormField({
  label,
  fieldId,
  hint,
  errorMessage,
  children,
}: {
  label: string;
  fieldId: string;
  hint?: string;
  errorMessage?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      {children}
      {hint !== undefined && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      <FormFieldError errorMessage={errorMessage} fieldId={fieldId} />
    </div>
  );
}
