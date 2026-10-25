import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { NameValueRowsEditor } from "@/components/common/name-value-rows-editor";
import { Input } from "@/components/ui/input";
import type { MockResponseFormValues } from "@/features/http/responses/use-response-rule-form";
import { CodeEditor } from "@/features/webhooks/templates/reference/code-editor/code-editor";

/** Status, header templates and the body template of a mock reply (HC-02.2). */
export function MockResponseFields({
  formValues,
  statusCodeError,
  onChange,
}: {
  formValues: MockResponseFormValues;
  statusCodeError: string | undefined;
  onChange: (changedValues: Partial<MockResponseFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();
  const contentType =
    formValues.headerRows.find(
      (headerRow) => headerRow.rowName.toLowerCase() === "content-type",
    )?.rowValue ?? "";

  return (
    <div className="grid gap-4">
      <FormField
        label="Status code"
        fieldId={`${fieldIdPrefix}-status`}
        errorMessage={statusCodeError}
      >
        <Input
          id={`${fieldIdPrefix}-status`}
          inputMode="numeric"
          className="w-28 font-mono"
          value={formValues.statusCode}
          aria-invalid={statusCodeError !== undefined}
          onChange={(changeEvent) => {
            onChange({ statusCode: changeEvent.target.value });
          }}
        />
      </FormField>
      <NameValueRowsEditor
        legend="Response headers"
        rowLabel="Response header"
        namePlaceholder="content-type"
        emptyText="None."
        rows={formValues.headerRows}
        onChange={(headerRows) => {
          onChange({ headerRows });
        }}
      />
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Response body</span>
        <CodeEditor
          ariaLabel="Response body"
          language={contentType.includes("json") ? "json" : "text"}
          minHeightClassName="min-h-32"
          value={formValues.body}
          templateReference={undefined}
          onChange={(body) => {
            onChange({ body });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Templates can echo the request: {"{{ request.json.text }}"},{" "}
          {"{{ request.method }}"}, {"{{ random_string(12) }}"}.
        </p>
      </div>
    </div>
  );
}
