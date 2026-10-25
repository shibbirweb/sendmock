import { useNavigate, useSearch } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmsCallbackAttempts } from "@/features/sms/drawer/sms-callback-attempts";
import { SmsManualStatus } from "@/features/sms/drawer/sms-manual-status";
import { SmsMessageFacts } from "@/features/sms/drawer/sms-message-facts";
import { SmsRequestPanel } from "@/features/sms/drawer/sms-request-panel";
import { SmsStatusHistory } from "@/features/sms/drawer/sms-status-history";
import { useSmsMessage } from "@/lib/api/hooks/use-sms-queries";

function SmsMessageDrawerBody({ smsId }: { smsId: string }) {
  const messageQuery = useSmsMessage(smsId);

  if (messageQuery.isPending) {
    return (
      <div className="grid gap-3 px-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (messageQuery.isError) {
    return (
      <p className="px-4 text-sm text-destructive">
        Could not load this message. It may have been deleted.
      </p>
    );
  }

  const smsMessage = messageQuery.data;

  return (
    <div className="grid gap-4 px-4 pb-6">
      <p className="rounded-md border bg-muted/30 p-3 text-sm break-words whitespace-pre-wrap">
        {smsMessage.body}
      </p>
      <SmsMessageFacts smsMessage={smsMessage} />
      {smsMessage.direction === "outbound" && (
        <>
          <Separator />
          <SmsManualStatus smsMessage={smsMessage} />
        </>
      )}
      <Separator />
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Status</TabsTrigger>
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="callbacks">
            Callbacks ({smsMessage.callback_attempts.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="pt-3">
          <SmsStatusHistory smsMessage={smsMessage} />
        </TabsContent>
        <TabsContent value="request" className="pt-3">
          <SmsRequestPanel smsMessage={smsMessage} />
        </TabsContent>
        <TabsContent value="callbacks" className="pt-3">
          <SmsCallbackAttempts smsMessage={smsMessage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Details of one message: status timeline, request JSON, callback attempts
 * and manual status. Open while the `message` search parameter is set, so the
 * drawer can be linked to and the back button closes it.
 */
export function SmsMessageDrawer() {
  const { message: openSmsId } = useSearch({
    from: "/sms/_conversations/$threadId",
  });
  const navigate = useNavigate({ from: "/sms/$threadId" });

  return (
    <Sheet
      open={openSmsId !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          void navigate({ search: { message: undefined } });
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Message details</SheetTitle>
          <SheetDescription>
            Status history, the original request and status callbacks.
          </SheetDescription>
        </SheetHeader>
        {openSmsId !== undefined && <SmsMessageDrawerBody smsId={openSmsId} />}
      </SheetContent>
    </Sheet>
  );
}
