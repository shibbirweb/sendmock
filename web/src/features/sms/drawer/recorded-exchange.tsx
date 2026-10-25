import type {
  RecordedHttpRequest,
  RecordedHttpResponse,
} from "@/lib/api/types";

function RecordedHeaders({ headers }: { headers: Record<string, string> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
      {Object.entries(headers).map(([headerName, headerValue]) => (
        <div key={headerName} className="contents">
          <dt className="text-muted-foreground">{headerName}</dt>
          <dd className="break-all">{headerValue}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A recorded request and its response, as sent and received. */
export function RecordedExchange({
  request,
  response,
}: {
  request: RecordedHttpRequest;
  response: RecordedHttpResponse | null;
}) {
  return (
    <div className="grid gap-3 border-t px-3 py-3">
      <div className="grid gap-1.5">
        <h4 className="text-xs font-medium">Request</h4>
        <p className="font-mono text-xs break-all">
          {request.method} {request.url}
        </p>
        <RecordedHeaders headers={request.headers} />
        <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 font-mono text-xs break-all whitespace-pre-wrap">
          {request.body}
        </pre>
      </div>
      <div className="grid gap-1.5">
        <h4 className="text-xs font-medium">Response</h4>
        {response === null ? (
          <p className="text-xs text-muted-foreground">No response received.</p>
        ) : (
          <>
            <p className="font-mono text-xs">{response.status_code}</p>
            {response.body !== "" && (
              <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap">
                {response.body}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
