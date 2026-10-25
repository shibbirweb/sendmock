import { SendIcon, SquarePenIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { ComposerTargetFields } from "@/features/webhooks/composer/composer-target-fields";
import { useComposer } from "@/features/webhooks/composer/use-composer";
import { SentDeliveryResult } from "@/features/webhooks/deliveries/sent-delivery-result";
import { EndpointRequestEditor } from "@/features/webhooks/endpoints/sheet/request/endpoint-request-editor";
import { EndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/endpoint-request-preview";
import { SendVariablesFields } from "@/features/webhooks/send/send-variables-fields";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";
import type { WebhookEndpoint } from "@/lib/api/types";
import { selectBodyEditorProblems } from "@/lib/webhooks/describe-problem-source";

function ComposerWorkspace({
  webhookEndpoints,
}: {
  webhookEndpoints: WebhookEndpoint[];
}) {
  const composer = useComposer(webhookEndpoints);
  const previewProblems = composer.requestPreview.previewQuery.data?.problems;
  const editorProblems = React.useMemo(
    () => selectBodyEditorProblems(previewProblems ?? []),
    [previewProblems],
  );

  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="grid min-w-0 gap-5">
        <EndpointRequestEditor
          formValues={composer.formValues}
          fieldErrors={composer.fieldErrors}
          savedEndpointId={null}
          editorProblems={editorProblems}
          onChange={composer.updateFormValues}
        >
          <ComposerTargetFields
            webhookEndpoints={webhookEndpoints}
            composer={composer}
          />
        </EndpointRequestEditor>
        <Separator />
        <SendVariablesFields
          endpointId={composer.targetEndpoint?.id ?? null}
          sendVariables={composer.sendVariables}
        />
      </div>
      <div className="grid min-w-0 gap-3 lg:sticky lg:top-0">
        <EndpointRequestPreview requestPreview={composer.requestPreview} />
        {composer.sentDelivery !== null && (
          <SentDeliveryResult sentDelivery={composer.sentDelivery} isSavable />
        )}
        {composer.blockingProblems.length > 0 && (
          <p className="text-xs text-destructive">
            Fix the errors in the preview to send.
          </p>
        )}
        <Button
          type="button"
          className="justify-self-end"
          disabled={
            composer.isSending ||
            composer.blockingProblems.length > 0 ||
            composer.requestPreview.previewQuery.data === undefined
          }
          onClick={composer.sendNow}
        >
          <SendIcon />
          Send
        </Button>
      </div>
    </div>
  );
}

/** A request written by hand and sent to an endpoint, like a small Postman (WH-05.3). */
export function ComposerPage() {
  const endpointsQuery = useWebhookEndpoints();
  const webhookEndpoints = endpointsQuery.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Composer</h2>
          <p className="text-sm text-muted-foreground">
            Write a webhook request by hand, start from any template, and send
            it to an endpoint.
          </p>
        </header>
        {endpointsQuery.isPending && <Skeleton className="h-96 w-full" />}
        {endpointsQuery.isSuccess && webhookEndpoints.length === 0 && (
          <NoDataState
            icon={SquarePenIcon}
            title="No endpoint to send to"
            description="The composer sends to an endpoint, which signs the request. Add one first."
          />
        )}
        {webhookEndpoints.length > 0 && (
          <ComposerWorkspace webhookEndpoints={webhookEndpoints} />
        )}
      </div>
    </div>
  );
}
