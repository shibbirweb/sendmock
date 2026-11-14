import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import type { WebhookEndpointFormValues } from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import { CodeEditor } from "@/features/webhooks/templates/reference/code-editor/code-editor";
import type {
  CodeEditorHandle,
  CodeEditorProblem,
} from "@/features/webhooks/templates/reference/code-editor/code-editor-types";
import { TemplateInsertMenu } from "@/features/webhooks/templates/reference/template-insert-menu";
import type { TemplateReference } from "@/lib/api/types";

const commonContentTypes = [
  "application/json",
  "application/x-www-form-urlencoded",
  "text/plain",
  "application/xml",
];

/** Raw body mode: a content type and the body in the code editor (WH-07.14). */
export function EndpointRawBody({
  formValues,
  contentTypeError,
  templateReference,
  editorProblems,
  onChange,
}: {
  formValues: WebhookEndpointFormValues;
  contentTypeError: string | undefined;
  templateReference: TemplateReference | undefined;
  /** Body problems from the preview, underlined at their line and column. */
  editorProblems: CodeEditorProblem[];
  onChange: (changedValues: Partial<WebhookEndpointFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();
  const editorHandleRef = React.useRef<CodeEditorHandle | null>(null);

  return (
    <div className="grid gap-4">
      <FormField
        label="Content type"
        fieldId={`${fieldIdPrefix}-content-type`}
        errorMessage={contentTypeError}
      >
        <Input
          id={`${fieldIdPrefix}-content-type`}
          list={`${fieldIdPrefix}-content-types`}
          className="font-mono text-xs"
          value={formValues.rawContentType}
          aria-invalid={contentTypeError !== undefined}
          onChange={(changeEvent) => {
            onChange({ rawContentType: changeEvent.target.value });
          }}
        />
        <datalist id={`${fieldIdPrefix}-content-types`}>
          {commonContentTypes.map((contentType) => (
            <option key={contentType} value={contentType} />
          ))}
        </datalist>
      </FormField>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Body</span>
          <TemplateInsertMenu
            onInsert={(insertText) => {
              editorHandleRef.current?.insertText(insertText);
            }}
          />
        </div>
        <CodeEditor
          ariaLabel="Raw body"
          language={
            formValues.rawContentType.includes("json") ? "json" : "text"
          }
          value={formValues.rawBody}
          templateReference={templateReference}
          problems={editorProblems}
          handleRef={editorHandleRef}
          onChange={(rawBody) => {
            onChange({ rawBody });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Type {"{{"} to see what you can use; hover a value to see an example.
        </p>
      </div>
    </div>
  );
}
