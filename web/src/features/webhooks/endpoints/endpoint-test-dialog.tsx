import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import { HttpStatusBadge } from "@/components/common/http-status-badge";
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
import type { WebhookDelivery } from "@/lib/api/types";
import { formatDurationMs } from "@/lib/format/format-values";

function TestDeliveryResult({
  testDelivery,
}: {
  testDelivery: WebhookDelivery;
}) {
  const signedHeaders = Object.entries(
    testDelivery.request?.headers ?? {},
  ).filter(([headerName]) => headerName.startsWith("webhook-"));

  return (
    <div className="grid min-w-0 gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {testDelivery.response === null ? (
          <span className="text-destructive">
            {testDelivery.error_message ?? "No response"}
          </span>
        ) : (
          <HttpStatusBadge statusCode={testDelivery.response.status_code} />
        )}
        {testDelivery.duration_ms !== null && (
          <span className="text-muted-foreground">
            in {formatDurationMs(testDelivery.duration_ms)}
          </span>
        )}
      </div>
      <section className="grid gap-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">
          Signed headers
        </h3>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border bg-muted/40 p-2.5 font-mono text-xs">
          {signedHeaders.map(([headerName, headerValue]) => (
            <div key={headerName} className="contents">
              <dt className="text-muted-foreground">{headerName}</dt>
              <dd className="break-all">{headerValue}</dd>
            </div>
          ))}
        </dl>
      </section>
      {testDelivery.response !== null && (
        <section className="grid gap-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">
            Response body
          </h3>
          <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-2.5 font-mono text-xs whitespace-pre-wrap">
            {testDelivery.response.body || "(empty)"}
          </pre>
        </section>
      )}
    </div>
  );
}

/** Result of "Send test": status, timing, signature headers, body (WH-01.2). */
export function EndpointTestDialog({
  endpointName,
  testDelivery,
  isSending,
  onClose,
}: {
  endpointName: string | null;
  testDelivery: WebhookDelivery | null;
  isSending: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={endpointName !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Test sent to {endpointName}</DialogTitle>
          <DialogDescription>
            A <code>test.ping</code> event, signed like a real delivery.
          </DialogDescription>
        </DialogHeader>
        {isSending && <Skeleton className="h-40 w-full" />}
        {!isSending && testDelivery !== null && (
          <TestDeliveryResult testDelivery={testDelivery} />
        )}
        <DialogFooter>
          {testDelivery !== null && (
            <Button variant="outline" asChild>
              <Link
                to="/webhooks/deliveries"
                search={{ delivery: testDelivery.id }}
              >
                <ExternalLinkIcon />
                Open delivery
              </Link>
            </Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
