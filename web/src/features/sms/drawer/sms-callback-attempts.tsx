import { ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { smsStatusLabels } from "@/features/sms/sms-labels";
import type {
  RecordedHttpRequest,
  RecordedHttpResponse,
  SmsCallbackAttempt,
  SmsMessageDetail,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";

function isSuccessfulResponse(response: RecordedHttpResponse | null) {
  return (
    response !== null &&
    response.status_code >= 200 &&
    response.status_code < 300
  );
}

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

function RecordedExchange({
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

function SmsCallbackAttemptRow({
  callbackAttempt,
}: {
  callbackAttempt: SmsCallbackAttempt;
}) {
  const response = callbackAttempt.response;
  const isSuccessful = isSuccessfulResponse(response);

  return (
    <li>
      <details className="group/callback rounded-md border">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open/callback:rotate-90 motion-reduce:transition-none" />
          <span className="font-medium">
            {smsStatusLabels[callbackAttempt.reported_status]}
          </span>
          <span className="text-xs text-muted-foreground">
            Attempt {callbackAttempt.attempt}
          </span>
          <Badge
            variant={isSuccessful ? "secondary" : "destructive"}
            className="ml-auto font-mono"
          >
            {response === null ? "No response" : response.status_code}
          </Badge>
          {callbackAttempt.duration_ms !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {callbackAttempt.duration_ms} ms
            </span>
          )}
          <time
            dateTime={callbackAttempt.created_at}
            className="w-full pl-6 text-xs text-muted-foreground"
          >
            {formatDateTime(callbackAttempt.created_at)}
            {callbackAttempt.error_message !== null &&
              `, ${callbackAttempt.error_message}`}
          </time>
        </summary>
        <RecordedExchange
          request={callbackAttempt.request}
          response={response}
        />
      </details>
    </li>
  );
}

/** Calls made to the message's status callback URL (SM-08.3), newest last. */
export function SmsCallbackAttempts({
  smsMessage,
}: {
  smsMessage: SmsMessageDetail;
}) {
  if (smsMessage.status_callback_url === null) {
    return (
      <p className="text-sm text-muted-foreground">
        This message has no status callback URL, so no callbacks are sent. Pass{" "}
        <code className="font-mono text-xs">StatusCallback</code> when sending
        to receive one per status change.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs break-all text-muted-foreground">
        Sent to{" "}
        <span className="font-mono">{smsMessage.status_callback_url}</span>
      </p>
      {smsMessage.callback_attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No callbacks yet. One is sent on every status change.
        </p>
      ) : (
        <ol aria-label="Callback attempts" className="grid gap-2">
          {smsMessage.callback_attempts.map((callbackAttempt, attemptIndex) => (
            <SmsCallbackAttemptRow
              key={`${callbackAttempt.id}-${attemptIndex}`}
              callbackAttempt={callbackAttempt}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
