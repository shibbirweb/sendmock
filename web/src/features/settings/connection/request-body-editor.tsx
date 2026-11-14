import { PlusIcon } from "lucide-react";
import * as React from "react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BodyEditorState } from "@/features/settings/connection/use-request-customization";
import type { JsonValue } from "@/lib/settings/json-literals";

export type OptionalBodyField = {
  fieldName: string;
  exampleValue: JsonValue;
};

function hasField(bodyState: BodyEditorState, fieldName: string): boolean {
  const currentBody = bodyState.lastValidBody;

  return (
    currentBody !== null &&
    typeof currentBody === "object" &&
    !Array.isArray(currentBody) &&
    fieldName in currentBody
  );
}

/** JSON body for one API call, with chips that add its optional fields. */
export function RequestBodyEditor({
  label,
  bodyState,
  optionalFields,
  hint,
  onBodyTextChange,
  onAddField,
}: {
  label: string;
  hint?: string;
  bodyState: BodyEditorState;
  optionalFields: OptionalBodyField[];
  onBodyTextChange: (bodyText: string) => void;
  onAddField: (fieldName: string, exampleValue: JsonValue) => void;
}) {
  const editorId = React.useId();

  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={editorId}>{label}</Label>
      <Textarea
        id={editorId}
        rows={7}
        spellCheck={false}
        className="font-mono text-xs"
        value={bodyState.bodyText}
        aria-invalid={bodyState.isInvalid}
        onChange={(changeEvent) => onBodyTextChange(changeEvent.target.value)}
      />
      {hint !== undefined && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      <FormFieldError
        errorMessage={
          bodyState.isInvalid
            ? "Not valid JSON yet; the snippets show the last valid body."
            : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Add field:</span>
        {optionalFields.map(({ fieldName, exampleValue }) => (
          <Button
            key={fieldName}
            type="button"
            variant="outline"
            size="xs"
            className="font-mono"
            disabled={bodyState.isInvalid || hasField(bodyState, fieldName)}
            onClick={() => onAddField(fieldName, exampleValue)}
          >
            <PlusIcon />
            {fieldName}
          </Button>
        ))}
      </div>
    </div>
  );
}
