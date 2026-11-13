import { EyeIcon, FlaskConicalIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SimulateClickMenu } from "@/features/mail/detail/simulate-click-menu";
import { WebhookTargets } from "@/features/webhooks/targets/webhook-targets";
import {
  useOpenEmail,
  useSimulateEmailOutcome,
} from "@/lib/api/hooks/use-email-queries";
import type {
  AppEventType,
  EmailDetail,
  SimulatedEmailOutcome,
} from "@/lib/api/types";

const simulatedOutcomes: {
  label: string;
  outcome: SimulatedEmailOutcome;
  eventType: AppEventType;
}[] = [
  {
    label: "Delivered",
    outcome: { event: "delivered" },
    eventType: "email.delivered",
  },
  {
    label: "Hard bounce",
    outcome: { event: "bounced", bounce_type: "hard" },
    eventType: "email.bounced",
  },
  {
    label: "Soft bounce",
    outcome: { event: "bounced", bounce_type: "soft" },
    eventType: "email.bounced",
  },
  {
    label: "Spam complaint",
    outcome: { event: "complained" },
    eventType: "email.complained",
  },
  {
    label: "Unsubscribe",
    outcome: { event: "unsubscribed" },
    eventType: "email.unsubscribed",
  },
];

/** The open the menu fires next, as its filter fields will read. */
function describeNextOpen(email: EmailDetail): Record<string, string[]> {
  return {
    open_count: [String(email.open_count + 1)],
    first_open: [String(email.open_count === 0)],
    source: ["manual"],
  };
}

/**
 * Mail's Simulate menu: an open, a click and each delivery outcome, each
 * naming the webhooks it will trigger with Choose beside it (WH-13.2).
 */
export function MailSimulateMenu({ email }: { email: EmailDetail }) {
  const openEmail = useOpenEmail();
  const simulateOutcome = useSimulateEmailOutcome();

  return (
    <WebhookTargets.MenuScope>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Simulate an event">
            <FlaskConicalIcon />
            Simulate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <WebhookTargets.MenuItem
            targetEvent={{
              eventType: "email.opened",
              subjectId: email.id,
              data: describeNextOpen(email),
            }}
            actionLabel="Simulate open"
            onSimulate={(webhookChoice) => {
              openEmail.mutate({
                emailId: email.id,
                openSource: "manual",
                webhookChoice,
              });
              toast("email.opened fired");
            }}
          >
            <EyeIcon />
            Open (email.opened)
          </WebhookTargets.MenuItem>
          <SimulateClickMenu email={email} />
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Delivery outcome</DropdownMenuLabel>
          {simulatedOutcomes.map(({ label, outcome, eventType }) => (
            <WebhookTargets.MenuItem
              key={label}
              targetEvent={{ eventType, subjectId: email.id }}
              actionLabel={`Simulate ${label.toLowerCase()}`}
              onSimulate={(webhookChoice) => {
                simulateOutcome.mutate({
                  emailId: email.id,
                  simulatedOutcome: { ...outcome, ...webhookChoice },
                });
                toast(`Simulated: ${label.toLowerCase()}`);
              }}
            >
              {label}
            </WebhookTargets.MenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </WebhookTargets.MenuScope>
  );
}
