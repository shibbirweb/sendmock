import * as React from "react";

import { HttpHeadersList } from "@/components/common/http-headers-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeEditor } from "@/features/webhooks/templates/reference/code-editor/code-editor";
import type { WebhookTargetEvent } from "@/features/webhooks/targets/use-webhook-targets";
import { useWebhookPayload } from "@/features/webhooks/targets/use-webhook-payload";
import type {
  MatchedWebhookRequest,
  WebhookRequestEdit,
} from "@/lib/api/types";

export type WebhookPayloadRequest = {
  targetEvent: WebhookTargetEvent;
  endpointId: string;
  endpointName: string;
  /** The body edited earlier for this action, or null for the rendered one. */
  editedBody: string | null;
  /** The confirm button, e.g. "Use this payload" or the action itself. */
  confirmLabel: string;
  /** Gets the edit, or null when the rendered body is sent. */
  onConfirm: (requestEdit: WebhookRequestEdit | null) => void;
};

function RenderedRequestLine({
  renderedRequest,
}: {
  renderedRequest: MatchedWebhookRequest;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 font-mono text-xs">
      <span className="font-semibold">{renderedRequest.method}</span>
      <span data-testid="payload-url" className="min-w-0 flex-1 break-all">
        {renderedRequest.url}
      </span>
    </div>
  );
}

function RenderProblems({
  renderedRequest,
}: {
  renderedRequest: MatchedWebhookRequest;
}) {
  if (renderedRequest.problems.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Render problems" className="grid gap-1 text-xs">
      {renderedRequest.problems.map((renderProblem) => (
        <li
          key={`${renderProblem.source}-${renderProblem.line}-${renderProblem.column}-${renderProblem.message}`}
          className={
            renderProblem.severity === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          }
        >
          {renderProblem.source}: {renderProblem.message}
        </li>
      ))}
    </ul>
  );
}

/**
 * The request one webhook of a simulation will send: method, URL, headers
 * with secrets masked, and the body in the code editor, editable for this
 * action only, with Reset and an Edited badge (WH-14.2, WH-14.3).
 */
export function WebhookPayloadDialog({
  payloadRequest,
  onClose,
}: {
  payloadRequest: WebhookPayloadRequest | null;
  onClose: () => void;
}) {
  const [shownRequest, setShownRequest] =
    React.useState<WebhookPayloadRequest | null>(null);
  const [draftBody, setDraftBody] = React.useState<string | null>(null);
  if (payloadRequest !== null && payloadRequest !== shownRequest) {
    setShownRequest(payloadRequest);
    setDraftBody(payloadRequest.editedBody);
  }
  const webhookPayload = useWebhookPayload(
    shownRequest?.targetEvent ?? { eventType: "email.received" },
    payloadRequest === null ? null : (shownRequest?.endpointId ?? null),
  );
  const { renderedRequest } = webhookPayload;
  const renderedBody = renderedRequest?.body ?? null;
  const isEdited = draftBody !== null && draftBody !== renderedBody;
  const contentType = renderedRequest?.headers["content-type"] ?? "";

  return (
    <Dialog
      open={payloadRequest !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Payload to {shownRequest?.endpointName}
            {isEdited && <Badge variant="secondary">Edited</Badge>}
          </DialogTitle>
          <DialogDescription>
            The request{" "}
            <span className="font-mono">
              {shownRequest?.targetEvent.eventType}
            </span>{" "}
            will send, rendered now. An edited body is sent exactly as written
            and signed over those bytes, for this action only; otherwise ids and
            times are made again when it is sent.
          </DialogDescription>
        </DialogHeader>
        {webhookPayload.isError && (
          <p className="text-sm text-destructive">
            Could not render the payload.
          </p>
        )}
        {webhookPayload.isLoading && <Skeleton className="h-60 w-full" />}
        {renderedRequest !== null && (
          <div className="grid min-w-0 gap-3">
            <RenderedRequestLine renderedRequest={renderedRequest} />
            <HttpHeadersList
              title="Headers"
              headers={renderedRequest.headers}
            />
            <CodeEditor
              ariaLabel="Payload body"
              language={contentType.includes("json") ? "json" : "text"}
              minHeightClassName="min-h-60"
              value={draftBody ?? renderedRequest.body}
              templateReference={undefined}
              onChange={setDraftBody}
            />
            <RenderProblems renderedRequest={renderedRequest} />
          </div>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            className="mr-auto"
            disabled={!isEdited}
            onClick={() => {
              setDraftBody(null);
            }}
          >
            Reset
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={renderedRequest === null}
            onClick={() => {
              if (shownRequest !== null) {
                shownRequest.onConfirm(
                  isEdited && draftBody !== null
                    ? {
                        endpoint_id: shownRequest.endpointId,
                        event_type: shownRequest.targetEvent.eventType,
                        body: draftBody,
                      }
                    : null,
                );
              }
              onClose();
            }}
          >
            {shownRequest?.confirmLabel ?? "Use this payload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
