import * as React from "react";

import { Separator } from "@/components/ui/separator";
import { EndpointRequestEditor } from "@/features/webhooks/endpoints/sheet/request/endpoint-request-editor";
import { EndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/endpoint-request-preview";
import { useEndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/use-endpoint-request-preview";
import {
  toEndpointInput,
  type WebhookEndpointFormValues,
} from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import { selectBodyEditorProblems } from "@/lib/webhooks/describe-problem-source";
import type { WebhookEndpointFieldErrors } from "@/lib/webhooks/validate-webhook-endpoint";

/** The endpoint sheet's Request tab: the request editor with the live preview under it (WH-07.15). */
export function EndpointRequestTab({
  formValues,
  fieldErrors,
  savedEndpointId,
  onChange,
}: {
  formValues: WebhookEndpointFormValues;
  fieldErrors: WebhookEndpointFieldErrors;
  savedEndpointId: string | null;
  onChange: (changedValues: Partial<WebhookEndpointFormValues>) => void;
}) {
  const requestPreview = useEndpointRequestPreview(
    toEndpointInput(formValues),
    {
      savedEndpointId,
    },
  );
  const previewProblems = requestPreview.previewQuery.data?.problems;
  const editorProblems = React.useMemo(
    () => selectBodyEditorProblems(previewProblems ?? []),
    [previewProblems],
  );

  return (
    <div className="grid gap-5">
      <EndpointRequestEditor
        formValues={formValues}
        fieldErrors={fieldErrors}
        savedEndpointId={savedEndpointId}
        editorProblems={editorProblems}
        onChange={onChange}
      />
      <Separator />
      <EndpointRequestPreview requestPreview={requestPreview} />
    </div>
  );
}
