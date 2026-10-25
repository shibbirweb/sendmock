import { CopyIcon, ForwardIcon, WebhookIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ForwardRequestDialog } from "@/features/http/requests/forward-request-dialog";
import { SendToWebhookDialog } from "@/features/webhooks/send/send-to-webhook-dialog";
import type { CapturedHttpRequest, HttpMethod } from "@/lib/api/types";
import { buildCurlCommand } from "@/lib/webhooks/build-curl-command";

/** Copy as cURL, Forward to URL and Send to webhook (HC-01.5, HC-01.7). */
export function CapturedRequestActions({
  capturedRequest,
}: {
  capturedRequest: CapturedHttpRequest;
}) {
  const [openDialog, setOpenDialog] = React.useState<
    "forward" | "webhook" | null
  >(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const curlCommand = buildCurlCommand({
            method: capturedRequest.method as HttpMethod,
            url: capturedRequest.url,
            headers: capturedRequest.headers,
            body: capturedRequest.body,
          });
          void navigator.clipboard.writeText(curlCommand).then(() => {
            toast("cURL command copied");
          });
        }}
      >
        <CopyIcon />
        Copy as cURL
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpenDialog("forward");
        }}
      >
        <ForwardIcon />
        Forward to URL
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpenDialog("webhook");
        }}
      >
        <WebhookIcon />
        Send to webhook
      </Button>
      {openDialog === "forward" && (
        <ForwardRequestDialog
          capturedRequest={capturedRequest}
          onClose={() => {
            setOpenDialog(null);
          }}
        />
      )}
      {openDialog === "webhook" && (
        <SendToWebhookDialog
          renderRequest={{ http_request_id: capturedRequest.id }}
          messageLabel={`${capturedRequest.method} ${capturedRequest.path}`}
          onClose={() => {
            setOpenDialog(null);
          }}
        />
      )}
    </div>
  );
}
