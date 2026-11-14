import { useNavigate } from "@tanstack/react-router";
import {
  DownloadIcon,
  FlaskConicalIcon,
  MailIcon,
  MailOpenIcon,
  MoreHorizontalIcon,
  SendIcon,
  Trash2Icon,
  WebhookIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/common/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MailSimulateMenu } from "@/features/mail/detail/mail-simulate-menu";
import { ReleaseEmailDialog } from "@/features/mail/detail/release-email-dialog";
import {
  canRespondToEmail,
  type EmailComposerMode,
} from "@/features/mail/detail/response/email-composer-mode";
import {
  OperationButton,
  OperationMenuItem,
} from "@/features/availability/operation-button";
import { EmailResponseButtons } from "@/features/mail/detail/response/email-response-buttons";
import { SendToWebhookDialog } from "@/features/webhooks/send/send-to-webhook-dialog";
import { appShortcuts } from "@/features/shortcuts/shortcut-catalog";
import { buildApiUrl } from "@/lib/api/api-client";
import {
  useDeleteEmail,
  useUpdateEmail,
} from "@/lib/api/hooks/use-email-queries";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";
import type { EmailDetail } from "@/lib/api/types";

export function MailDetailActions({
  email,
  onStartResponse,
}: {
  email: EmailDetail;
  onStartResponse: (composerMode: EmailComposerMode) => void;
}) {
  const navigate = useNavigate();
  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();
  const [isReleaseDialogOpen, setReleaseDialogOpen] = React.useState(false);
  const [isSendDialogOpen, setSendDialogOpen] = React.useState(false);
  // Replies, forwards and outcome simulations only apply to mail your app sent.
  const isSentByApp = canRespondToEmail(email);
  const simulateAvailability = useOperationAvailability(
    "POST /api/v1/emails/{emailId}/simulate",
  );

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {isSentByApp && (
        <EmailResponseButtons email={email} onStartResponse={onStartResponse} />
      )}
      <IconButton
        variant="ghost"
        label={email.is_read ? "Mark as unread" : "Mark as read"}
        onClick={() => {
          updateEmail.mutate({
            emailId: email.id,
            emailUpdate: { is_read: !email.is_read },
          });
        }}
      >
        {email.is_read ? <MailIcon /> : <MailOpenIcon />}
      </IconButton>
      <IconButton
        variant="ghost"
        label="Delete email"
        shortcutKeys={appShortcuts.deleteOpenItem.keys}
        onClick={() => {
          deleteEmail.mutate(email.id);
          toast("Email deleted");
          void navigate({
            to: "/mail",
            search: (previousSearch) => previousSearch,
          });
        }}
      >
        <Trash2Icon />
      </IconButton>
      {isSentByApp && !simulateAvailability.isAvailable && (
        <OperationButton
          operationKey="POST /api/v1/emails/{emailId}/simulate"
          actionName="Simulate an event"
          variant="outline"
          size="sm"
        >
          <FlaskConicalIcon />
          Simulate
        </OperationButton>
      )}
      {isSentByApp && simulateAvailability.isAvailable && (
        <MailSimulateMenu email={email} />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton variant="ghost" label="More actions">
            <MoreHorizontalIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a
              href={buildApiUrl(`/emails/${email.id}/raw`)}
              download={`${email.id}.eml`}
            >
              <DownloadIcon />
              Download .eml
            </a>
          </DropdownMenuItem>
          <OperationMenuItem
            operationKey="POST /api/v1/emails/{emailId}/release"
            onSelect={() => {
              setReleaseDialogOpen(true);
            }}
          >
            <SendIcon />
            Release to real SMTP
          </OperationMenuItem>
          <OperationMenuItem
            operationKey="POST /api/v1/webhooks/endpoints/{endpointId}/send"
            onSelect={() => {
              setSendDialogOpen(true);
            }}
          >
            <WebhookIcon />
            Send to webhook
          </OperationMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isSendDialogOpen && (
        <SendToWebhookDialog
          renderRequest={{ email_id: email.id }}
          messageLabel={email.subject || "(no subject)"}
          onClose={() => {
            setSendDialogOpen(false);
          }}
        />
      )}
      <ReleaseEmailDialog
        email={email}
        isOpen={isReleaseDialogOpen}
        onOpenChange={setReleaseDialogOpen}
      />
    </div>
  );
}
