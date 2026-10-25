/** Validation message under a form field; nothing when the field is valid. */
export function FormFieldError({
  errorMessage,
  fieldId,
}: {
  errorMessage: string | undefined;
  /** Gives the message an id the field can point to with aria-describedby. */
  fieldId?: string;
}) {
  if (errorMessage === undefined) {
    return null;
  }

  return (
    <p
      id={fieldId === undefined ? undefined : `${fieldId}-error`}
      className="text-xs text-destructive"
    >
      {errorMessage}
    </p>
  );
}
