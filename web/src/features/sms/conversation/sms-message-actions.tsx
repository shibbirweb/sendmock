import { Link } from "@tanstack/react-router";
import {
  CheckCheckIcon,
  CopyIcon,
  HashIcon,
  InfoIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  WebhookIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SendToWebhookDialog } from "@/features/webhooks/send/send-to-webhook-dialog";
import { OperationMenuItem } from "@/features/availability/operation-button";
import { useDeleteSms, useOpenSms } from "@/lib/api/hooks/use-sms-queries";
import type { SmsMessage } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function copyToClipboard(copiedText: string, confirmation: string) {
  void navigator.clipboard.writeText(copiedText).then(() => {
    toast(confirmation);
  });
}

/** Per-message menu: details, simulate read, send to webhook, copy, delete. Shown on hover or focus. */
export function SmsMessageActions({
  smsMessage,
  className,
}: {
  smsMessage: SmsMessage;
  className?: string;
}) {
  const openSms = useOpenSms();
  const deleteSms = useDeleteSms();
  const isOutbound = smsMessage.direction === "outbound";
  const [isSendDialogOpen, setSendDialogOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Message actions"
            className={cn(
              "size-7 shrink-0 opacity-0 group-hover/sms-bubble:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
              className,
            )}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOutbound ? "end" : "start"}>
          <DropdownMenuItem asChild>
            <Link
              from="/sms/$threadId"
              to="."
              search={{ message: smsMessage.id }}
            >
              <InfoIcon />
              Message details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isOutbound && (
            <>
              <OperationMenuItem
                operationKey="POST /api/v1/sms/{smsId}/open"
                onSelect={() => {
                  openSms.mutate(
                    { smsId: smsMessage.id, openSource: "manual" },
                    {
                      onSuccess: () => {
                        toast("Read event fired");
                      },
                    },
                  );
                }}
              >
                <CheckCheckIcon />
                Simulate read
              </OperationMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <OperationMenuItem
            operationKey="POST /api/v1/webhooks/endpoints/{endpointId}/send"
            onSelect={() => {
              setSendDialogOpen(true);
            }}
          >
            <WebhookIcon />
            Send to webhook
          </OperationMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              copyToClipboard(smsMessage.body, "Message text copied");
            }}
          >
            <CopyIcon />
            Copy text
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              copyToClipboard(smsMessage.provider_id, "Message ID copied");
            }}
          >
            <HashIcon />
            Copy message ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              deleteSms.mutate(smsMessage.id);
              toast("Message deleted");
            }}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isSendDialogOpen && (
        <SendToWebhookDialog
          renderRequest={{ sms_id: smsMessage.id }}
          messageLabel={smsMessage.body}
          onClose={() => {
            setSendDialogOpen(false);
          }}
        />
      )}
    </>
  );
}
