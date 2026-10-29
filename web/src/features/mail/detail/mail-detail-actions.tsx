import { useNavigate } from "@tanstack/react-router";
import {
  DownloadIcon,
  EyeIcon,
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

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { buildApiUrl } from "@/lib/api/api-client";
import {
  useDeleteEmail,
  useOpenEmail,
  useSimulateEmailOutcome,
  useUpdateEmail,
} from "@/lib/api/hooks/use-email-queries";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";
import type { EmailDetail, SimulatedEmailOutcome } from "@/lib/api/types";

const simulatedOutcomes: { label: string; outcome: SimulatedEmailOutcome }[] = [
  { label: "Delivered", outcome: { event: "delivered" } },
  { label: "Hard bounce", outcome: { event: "bounced", bounce_type: "hard" } },
  { label: "Soft bounce", outcome: { event: "bounced", bounce_type: "soft" } },
  { label: "Spam complaint", outcome: { event: "complained" } },
  { label: "Unsubscribe", outcome: { event: "unsubscribed" } },
];

export function MailDetailActions({
  email,
  onStartResponse,
}: {
  email: EmailDetail;
  onStartResponse: (composerMode: EmailComposerMode) => void;
}) {
  const navigate = useNavigate();
  const updateEmail = useUpdateEmail();
  const openEmail = useOpenEmail();
  const simulateOutcome = useSimulateEmailOutcome();
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
      <Button
        variant="ghost"
        size="icon"
        aria-label={email.is_read ? "Mark as unread" : "Mark as read"}
        onClick={() => {
          updateEmail.mutate({
            emailId: email.id,
            emailUpdate: { is_read: !email.is_read },
          });
        }}
      >
        {email.is_read ? <MailIcon /> : <MailOpenIcon />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete email"
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
      </Button>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Simulate an event">
              <FlaskConicalIcon />
              Simulate
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                openEmail.mutate({ emailId: email.id, openSource: "manual" });
                toast("email.opened fired");
              }}
            >
              <EyeIcon />
              Open (email.opened)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Delivery outcome</DropdownMenuLabel>
            {simulatedOutcomes.map(({ label, outcome }) => (
              <DropdownMenuItem
                key={label}
                onSelect={() => {
                  simulateOutcome.mutate({
                    emailId: email.id,
                    simulatedOutcome: outcome,
                  });
                  toast(`Simulated: ${label.toLowerCase()}`);
                }}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreHorizontalIcon />
          </Button>
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
