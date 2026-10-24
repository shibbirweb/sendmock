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
import { buildApiUrl } from "@/lib/api/api-client";
import {
  useDeleteEmail,
  useOpenEmail,
  useSimulateEmailOutcome,
  useUpdateEmail,
} from "@/lib/api/hooks/use-email-queries";
import type { EmailDetail, SimulatedEmailOutcome } from "@/lib/api/types";

const simulatedOutcomes: { label: string; outcome: SimulatedEmailOutcome }[] = [
  { label: "Delivered", outcome: { event: "delivered" } },
  { label: "Hard bounce", outcome: { event: "bounced", bounce_type: "hard" } },
  { label: "Soft bounce", outcome: { event: "bounced", bounce_type: "soft" } },
  { label: "Spam complaint", outcome: { event: "complained" } },
  { label: "Unsubscribe", outcome: { event: "unsubscribed" } },
];

export function MailDetailActions({ email }: { email: EmailDetail }) {
  const navigate = useNavigate();
  const updateEmail = useUpdateEmail();
  const openEmail = useOpenEmail();
  const simulateOutcome = useSimulateEmailOutcome();
  const deleteEmail = useDeleteEmail();
  const [isReleaseDialogOpen, setReleaseDialogOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-1">
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
          <DropdownMenuItem
            onSelect={() => {
              setReleaseDialogOpen(true);
            }}
          >
            <SendIcon />
            Release to real SMTP
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <WebhookIcon />
            Send to webhook (with the webhook screens)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReleaseEmailDialog
        email={email}
        isOpen={isReleaseDialogOpen}
        onOpenChange={setReleaseDialogOpen}
      />
    </div>
  );
}
