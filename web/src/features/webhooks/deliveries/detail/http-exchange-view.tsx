import { HttpBodyView } from "@/components/common/http-body-view";
import { HttpHeadersList } from "@/components/common/http-headers-list";
import { HttpStatusBadge } from "@/components/common/http-status-badge";
import type {
  RecordedHttpRequest,
  RecordedHttpResponse,
} from "@/lib/api/types";

function readContentType(headers: Record<string, string>): string | null {
  const contentTypeEntry = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === "content-type",
  );

  return contentTypeEntry?.[1] ?? null;
}

/** Request and response side by side on wide screens, stacked on phones (WH-03.8). */
export function HttpExchangeView({
  recordedRequest,
  recordedResponse,
}: {
  recordedRequest: RecordedHttpRequest;
  recordedResponse: RecordedHttpResponse | null;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section
        aria-label="Request"
        className="grid min-w-0 content-start gap-3"
      >
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium">
          Request
          <span className="rounded border px-1 font-mono text-[11px]">
            {recordedRequest.method}
          </span>
        </h3>
        <code className="block font-mono text-xs break-all">
          {recordedRequest.url}
        </code>
        <HttpHeadersList
          title="Request headers"
          headers={recordedRequest.headers}
        />
        <HttpBodyView
          title="Request body"
          bodyText={recordedRequest.body}
          contentType={readContentType(recordedRequest.headers)}
        />
      </section>
      <section
        aria-label="Response"
        className="grid min-w-0 content-start gap-3"
      >
        <h3 className="flex items-center gap-2 text-sm font-medium">
          Response
          {recordedResponse !== null && (
            <HttpStatusBadge statusCode={recordedResponse.status_code} />
          )}
        </h3>
        {recordedResponse === null ? (
          <p className="text-sm text-muted-foreground">
            No response: the request did not get an answer.
          </p>
        ) : (
          <>
            <HttpHeadersList
              title="Response headers"
              headers={recordedResponse.headers}
            />
            <HttpBodyView
              title="Response body"
              bodyText={recordedResponse.body}
              contentType={readContentType(recordedResponse.headers)}
            />
            {recordedResponse.is_body_truncated && (
              <p className="text-xs text-muted-foreground">
                Body truncated at 64 KB; the rest was not stored.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
