import { Link } from "@tanstack/react-router";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SmsConversationHeader } from "@/features/sms/conversation/sms-conversation-header";
import { SmsInboundComposer } from "@/features/sms/conversation/sms-inbound-composer";
import { SmsMessageTimeline } from "@/features/sms/conversation/sms-message-timeline";
import { useSmsList, useSmsThreads } from "@/lib/api/hooks/use-sms-queries";

/** Enough for any test conversation; older messages are pruned by retention. */
const conversationPageSize = 500;

export function SmsConversation({ threadId }: { threadId: string }) {
  const threadsQuery = useSmsThreads();
  const messagesQuery = useSmsList({
    thread_id: threadId,
    limit: conversationPageSize,
  });
  const smsThread = threadsQuery.data?.find(
    (candidateThread) => candidateThread.thread_id === threadId,
  );
  const smsMessagesOldestFirst = React.useMemo(
    () => [...(messagesQuery.data?.items ?? [])].reverse(),
    [messagesQuery.data],
  );

  if (threadsQuery.isPending || messagesQuery.isPending) {
    return (
      <div className="grid gap-4 p-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="ml-auto h-12 w-2/3" />
        <Skeleton className="h-12 w-1/2" />
      </div>
    );
  }
  if (messagesQuery.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">
          Could not load this conversation.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void messagesQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (smsThread === undefined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          This conversation no longer exists. Its messages may have been deleted
          or pruned.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/sms">Back to conversations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SmsConversationHeader smsThread={smsThread} />
      <SmsMessageTimeline smsMessagesOldestFirst={smsMessagesOldestFirst} />
      <SmsInboundComposer smsThread={smsThread} />
    </div>
  );
}
