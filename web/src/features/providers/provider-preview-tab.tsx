import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TemplateReferencePanel } from "@/features/webhooks/templates/reference/template-reference-panel";
import { OptionSelect } from "@/features/providers/option-select";
import { httpMethods } from "@/features/providers/provider-options";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";
import { buildSampleRequest } from "@/lib/providers/build-sample-request";
import type { ProviderSampleRequest } from "@/lib/api/types";

function PreviewBlock({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="grid gap-1.5 rounded-lg border p-3"
      data-testid={testId}
    >
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A sample request run through the unsaved provider: the message SendMock
 * would store and the answer it would give, with problems (EM-18.4, SM-16.4).
 */
export function ProviderPreviewTab({
  providerForm,
}: {
  providerForm: MessageProviderForm;
}) {
  const { previewQuery, sampleRequest, changeSampleRequest } = providerForm;
  const providerPreview = previewQuery.data;
  // Until the sample is edited, show the default send the preview runs.
  const shownRequest: ProviderSampleRequest =
    sampleRequest ??
    buildSampleRequest(providerForm.providerArea, providerForm.providerInput);
  const editSample = (changedFields: Partial<ProviderSampleRequest>) => {
    changeSampleRequest({ ...shownRequest, ...changedFields });
  };

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <PreviewBlock title="Sample request" testId="provider-sample-request">
          <p className="text-xs text-muted-foreground">
            {sampleRequest === undefined
              ? "A send built from the field mapping. Edit it to try another request."
              : "Your request."}
          </p>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
            <OptionSelect
              ariaLabel="Sample method"
              value={shownRequest.method}
              options={httpMethods.map((method) => ({
                value: method,
                label: method,
              }))}
              onChange={(method) => editSample({ method })}
            />
            <Input
              aria-label="Sample path"
              className="h-7 font-mono text-xs"
              value={shownRequest.path}
              onChange={(changeEvent) =>
                editSample({ path: changeEvent.target.value })
              }
            />
          </div>
          <Textarea
            aria-label="Sample body"
            className="min-h-28 font-mono text-xs"
            value={shownRequest.body}
            onChange={(changeEvent) =>
              editSample({ body: changeEvent.target.value })
            }
          />
          {sampleRequest !== undefined && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => changeSampleRequest(undefined)}
            >
              Use the default send
            </Button>
          )}
        </PreviewBlock>
        <PreviewBlock title="Stored message" testId="provider-stored-message">
          {providerPreview?.stored_message == null ? (
            <p className="text-xs text-muted-foreground">
              Nothing is stored: the request is refused.
            </p>
          ) : (
            <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-1 text-xs">
              <dt className="text-muted-foreground">From</dt>
              <dd className="font-mono">
                {providerPreview.stored_message.from}
              </dd>
              <dt className="text-muted-foreground">To</dt>
              <dd className="font-mono">
                {providerPreview.stored_message.to.join(", ")}
              </dd>
              {providerPreview.stored_message.subject !== null && (
                <>
                  <dt className="text-muted-foreground">Subject</dt>
                  <dd>{providerPreview.stored_message.subject}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Body</dt>
              <dd className="break-words">
                {providerPreview.stored_message.body}
              </dd>
            </dl>
          )}
        </PreviewBlock>
        <PreviewBlock title="Response" testId="provider-preview-response">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">
              {providerPreview?.response.status ?? "..."}
            </Badge>
            {providerPreview?.operation_kind != null && (
              <span className="text-muted-foreground">
                Matched the {providerPreview.operation_kind} request
              </span>
            )}
          </div>
          <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
            {providerPreview?.response.body ?? ""}
          </pre>
        </PreviewBlock>
        {(providerPreview?.problems.length ?? 0) > 0 && (
          <ul aria-label="Problems" className="grid gap-1 text-xs">
            {providerPreview?.problems.map((problem, problemIndex) => (
              <li
                key={problemIndex}
                className={
                  problem.severity === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {problem.part}: {problem.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <TemplateReferencePanel
        templateReference={providerPreview?.reference}
        onInsert={(insertText) => {
          void navigator.clipboard?.writeText(insertText);
          toast(`Copied ${insertText}`);
        }}
      />
    </div>
  );
}
