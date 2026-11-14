import { Link } from "@tanstack/react-router";
import { ScrollTextIcon } from "lucide-react";

import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { labelSmsApi } from "@/features/sms/sms-labels";
import type { SmsMessageDetail } from "@/lib/api/types";

/** The body the app sent to the SMS API, with a link to the request log. */
export function SmsRequestPanel({
  smsMessage,
}: {
  smsMessage: SmsMessageDetail;
}) {
  if (smsMessage.request_body === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Inbound messages are not created by an API request, so there is no
        request body.
      </p>
    );
  }

  const requestJson = JSON.stringify(smsMessage.request_body, null, 2);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Sent to the {labelSmsApi(smsMessage.api)} API
        </span>
        <div className="flex items-center gap-1">
          <CopyButton copyText={requestJson} label="Copy request JSON" />
          {smsMessage.api_request_id !== null && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/logs" search={{ request: smsMessage.api_request_id }}>
                <ScrollTextIcon />
                Open in request log
              </Link>
            </Button>
          )}
        </div>
      </div>
      <pre
        aria-label="Request JSON"
        className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
      >
        {requestJson}
      </pre>
    </div>
  );
}
