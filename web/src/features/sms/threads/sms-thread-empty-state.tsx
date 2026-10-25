import { MessageSquareIcon, SearchXIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSendSms } from "@/lib/api/hooks/use-sms-queries";

const sampleSms = {
  from: "+15550001111",
  to: "+14155550100",
  body: "Your Acme verification code is 615204. It expires in 10 minutes.",
};

/** Shown when there are no conversations: how to connect, or how to widen the filter. */
export function SmsThreadEmptyState({
  hasActiveFilter,
  onClearFilter,
}: {
  hasActiveFilter: boolean;
  onClearFilter: () => void;
}) {
  const sendSms = useSendSms();

  if (hasActiveFilter) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <SearchXIcon className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No conversations match this filter.
        </p>
        <Button variant="outline" size="sm" onClick={onClearFilter}>
          Clear filter
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <MessageSquareIcon className="size-8 text-muted-foreground" />
      <div className="grid gap-1">
        <p className="text-sm font-medium">No SMS yet</p>
        <p className="text-sm text-muted-foreground">
          Send through the SendMock API, or point your Twilio or Vonage SDK at
          SendMock.
        </p>
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 rounded-md border bg-muted/40 px-4 py-2 text-left font-mono text-xs">
        <dt className="text-muted-foreground">Native</dt>
        <dd>POST 127.0.0.1:8025/api/v1/sms</dd>
        <dt className="text-muted-foreground">Twilio</dt>
        <dd>127.0.0.1:8025/providers/twilio</dd>
        <dt className="text-muted-foreground">Vonage</dt>
        <dd>127.0.0.1:8025/providers/vonage</dd>
      </dl>
      <Button
        size="sm"
        disabled={sendSms.isPending}
        onClick={() => {
          sendSms.mutate(sampleSms, {
            onError: () => {
              toast.error("Could not send the sample SMS");
            },
          });
        }}
      >
        <SendIcon />
        Send a sample SMS
      </Button>
    </div>
  );
}
