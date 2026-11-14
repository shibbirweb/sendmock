import { ArrowLeftIcon } from "lucide-react";

import { CopyButton } from "@/components/common/copy-button";
import { HttpHeadersList } from "@/components/common/http-headers-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessagePreviewView } from "@/features/http/previews/message-preview-view";
import { CapturedBodyView } from "@/features/http/requests/captured-body-view";
import { CapturedRequestActions } from "@/features/http/requests/captured-request-actions";
import { CapturedResponseView } from "@/features/http/requests/captured-response-view";
import { HttpMethodBadge } from "@/features/http/requests/http-method-badge";
import { useCapturedHttpRequest } from "@/lib/api/hooks/use-http-catcher-queries";
import type { HttpBin } from "@/lib/api/types";
import { formatDateTime, formatDurationMs } from "@/lib/format/format-values";
import { parseMessagePreview } from "@/lib/http/parse-message-preview";

/** One captured request: what the app sent and what SendMock answered (HC-01.7). */
export function CapturedRequestDetail({
  requestId,
  httpBins,
  onClose,
}: {
  requestId: string;
  httpBins: HttpBin[];
  onClose: () => void;
}) {
  const requestQuery = useCapturedHttpRequest(requestId);
  const capturedRequest = requestQuery.data;
  if (requestQuery.isPending) {
    return <Skeleton className="m-4 h-80" />;
  }
  if (capturedRequest === undefined) {
    return (
      <p className="m-auto p-6 text-sm text-muted-foreground">
        This request is gone; it may have been cleared.
      </p>
    );
  }

  const binPreset =
    httpBins.find((httpBin) => httpBin.id === capturedRequest.bin_id)?.preset ??
    null;
  const messagePreview = parseMessagePreview(capturedRequest, binPreset);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="grid gap-3 border-b p-4">
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start md:hidden"
          onClick={onClose}
        >
          <ArrowLeftIcon />
          Requests
        </Button>
        <div className="flex min-w-0 items-start gap-2">
          <HttpMethodBadge method={capturedRequest.method} className="mt-0.5" />
          <span
            data-testid="request-url"
            className="min-w-0 flex-1 font-mono text-sm break-all"
          >
            {capturedRequest.url}
          </span>
          <CopyButton
            copyText={capturedRequest.url}
            label="Copy URL"
            className="size-7"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(capturedRequest.created_at)} from{" "}
          {capturedRequest.client_ip}, answered in{" "}
          {formatDurationMs(capturedRequest.duration_ms)}
        </p>
        <CapturedRequestActions capturedRequest={capturedRequest} />
      </header>
      <Tabs
        defaultValue={messagePreview === null ? "body" : "preview"}
        className="gap-3 p-4"
      >
        <div className="overflow-x-auto">
          <TabsList>
            {messagePreview !== null && (
              <TabsTrigger value="preview">Preview</TabsTrigger>
            )}
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
            <TabsTrigger value="query">Query</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
          </TabsList>
        </div>
        {messagePreview !== null && (
          <TabsContent value="preview">
            <MessagePreviewView messagePreview={messagePreview} />
          </TabsContent>
        )}
        <TabsContent value="body">
          <CapturedBodyView capturedRequest={capturedRequest} />
        </TabsContent>
        <TabsContent value="headers">
          <HttpHeadersList
            title="Request headers"
            headers={capturedRequest.headers}
          />
        </TabsContent>
        <TabsContent value="query">
          {Object.keys(capturedRequest.query).length === 0 ? (
            <p className="text-sm text-muted-foreground">No query string.</p>
          ) : (
            <HttpHeadersList
              title="Query parameters"
              headers={capturedRequest.query}
            />
          )}
        </TabsContent>
        <TabsContent value="response">
          <CapturedResponseView capturedRequest={capturedRequest} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
