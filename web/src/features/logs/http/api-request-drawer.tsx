import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { HttpBodyView } from "@/features/logs/http/http-body-view";
import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { readApiLabel } from "@/features/logs/logs-labels";
import { useApiRequest } from "@/lib/api/hooks/use-logs-queries";
import type {
  ApiRequestLinkedMessage,
  ApiRequestLogEntry,
} from "@/lib/api/types";
import { formatDateTime, formatDurationMs } from "@/lib/format/format-values";

function readHeaderValue(
  requestHeaders: Record<string, string>,
  headerName: string,
): string | null {
  const matchingName = Object.keys(requestHeaders).find(
    (existingName) => existingName.toLowerCase() === headerName,
  );

  return matchingName === undefined
    ? null
    : (requestHeaders[matchingName] ?? null);
}

/** The SMS or email the request created (SM-13.3). */
function LinkedMessageButton({
  linkedMessage,
}: {
  linkedMessage: ApiRequestLinkedMessage;
}) {
  if (linkedMessage.kind === "email") {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/mail/$emailId" params={{ emailId: linkedMessage.id }}>
          <ExternalLinkIcon />
          Open email
        </Link>
      </Button>
    );
  }
  if (linkedMessage.sms_thread_id === null) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        to="/sms/$threadId"
        params={{ threadId: linkedMessage.sms_thread_id }}
        search={{ message: linkedMessage.id }}
      >
        <ExternalLinkIcon />
        Open SMS
      </Link>
    </Button>
  );
}

function ApiRequestDetails({ apiRequest }: { apiRequest: ApiRequestLogEntry }) {
  const headerEntries = Object.entries(apiRequest.request_headers);

  return (
    <div className="grid gap-4 px-4 pb-6">
      <div className="grid gap-2">
        <p className="font-mono text-sm break-all">
          <span className="font-semibold">{apiRequest.method}</span>{" "}
          {apiRequest.path}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <HttpStatusBadge statusCode={apiRequest.response_status} />
          <span className="rounded border px-1 text-[10px] uppercase">
            {readApiLabel(apiRequest.api)}
          </span>
          <span>{formatDateTime(apiRequest.created_at)}</span>
          <span>{formatDurationMs(apiRequest.duration_ms)}</span>
        </div>
        {apiRequest.linked_message !== null && (
          <div>
            <LinkedMessageButton linkedMessage={apiRequest.linked_message} />
          </div>
        )}
      </div>
      <section aria-label="Request headers" className="grid gap-1.5">
        <h4 className="text-xs font-medium text-muted-foreground">
          Request headers
        </h4>
        {headerEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No headers recorded</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 font-mono text-xs">
            {headerEntries.map(([headerName, headerValue]) => (
              <div key={headerName} className="contents">
                <dt className="text-muted-foreground">{headerName}</dt>
                <dd className="break-all">{headerValue}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <HttpBodyView
        title="Request body"
        bodyText={apiRequest.request_body}
        contentType={readHeaderValue(
          apiRequest.request_headers,
          "content-type",
        )}
      />
      <HttpBodyView title="Response body" bodyText={apiRequest.response_body} />
      <p className="text-xs text-muted-foreground">
        Credentials such as API keys and passwords are masked before logging.
      </p>
    </div>
  );
}

function ApiRequestDrawerContent({ requestId }: { requestId: string }) {
  const requestQuery = useApiRequest(requestId);

  if (requestQuery.isPending) {
    return (
      <div className="grid gap-3 px-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (requestQuery.isError) {
    return (
      <p className="px-4 text-sm text-destructive">
        This request is no longer in the log. It may have been pruned.
      </p>
    );
  }

  return <ApiRequestDetails apiRequest={requestQuery.data} />;
}

/** One logged API request and its response, open while `?request=` is set. */
export function ApiRequestDrawer() {
  const { request: openRequestId } = useSearch({ from: "/logs" });
  const navigate = useNavigate({ from: "/logs" });

  return (
    <Sheet
      open={openRequestId !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          void navigate({
            search: (previousSearch) => ({
              ...previousSearch,
              tab: "http" as const,
              request: undefined,
            }),
          });
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>API request</SheetTitle>
          <SheetDescription>
            Exactly what your app sent and what SendMock answered.
          </SheetDescription>
        </SheetHeader>
        {openRequestId !== undefined && (
          <ApiRequestDrawerContent requestId={openRequestId} />
        )}
      </SheetContent>
    </Sheet>
  );
}
