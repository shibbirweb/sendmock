import { MailIcon, MessageSquareIcon } from "lucide-react";

import { AnimatedList } from "@/components/ui/animated-list";
import { Marquee } from "@/components/ui/marquee";

import {
  SceneCard,
  StatusPill,
  type StatusTone,
  VisualFrame,
} from "./visual-parts";

const caughtEmails = [
  { sender: "Acme", subject: "Welcome aboard", check: "HTML preview" },
  {
    sender: "Acme Billing",
    subject: "Invoice INV-2026-0042",
    check: "PDF attached",
  },
  {
    sender: "Acme Security",
    subject: "Reset your password",
    check: "Links checked",
  },
  {
    sender: "Acme News",
    subject: "Your weekly report",
    check: "Spam score 0.4",
  },
  { sender: "Acme Store", subject: "Order 1042 has shipped", check: "Opened" },
];

/**
 * Each row keeps its full height (the second row runs into the card's fade
 * instead of being squeezed), and fades at the left and right edges.
 */
const emailMarqueeClassName =
  "shrink-0 [--duration:30s] [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]";

function CaughtEmailCard({
  caughtEmail,
}: {
  caughtEmail: (typeof caughtEmails)[number];
}) {
  return (
    <SceneCard className="w-52">
      <div className="flex items-center gap-2">
        <MailIcon className="size-3.5 text-(--brand-from)" />
        <span className="font-semibold">{caughtEmail.sender}</span>
      </div>
      <p className="mt-1 truncate text-fd-muted-foreground">
        {caughtEmail.subject}
      </p>
      <div className="mt-2">
        <StatusPill tone="success">{caughtEmail.check}</StatusPill>
      </div>
    </SceneCard>
  );
}

/** Emails flowing past in two rows, each with what SendMock checked. */
export function EmailVisual() {
  return (
    <VisualFrame className="flex flex-col pt-3">
      <Marquee pauseOnHover className={emailMarqueeClassName}>
        {caughtEmails.map((caughtEmail) => (
          <CaughtEmailCard
            key={caughtEmail.subject}
            caughtEmail={caughtEmail}
          />
        ))}
      </Marquee>
      <Marquee pauseOnHover reverse className={emailMarqueeClassName}>
        {[...caughtEmails].reverse().map((caughtEmail) => (
          <CaughtEmailCard
            key={caughtEmail.subject}
            caughtEmail={caughtEmail}
          />
        ))}
      </Marquee>
    </VisualFrame>
  );
}

const caughtTextMessages: {
  sender: string;
  body: string;
  status: string;
  tone: StatusTone;
}[] = [
  {
    sender: "Twilio to +1 555 0100",
    body: "Your verification code is 482913",
    status: "delivered",
    tone: "success",
  },
  {
    sender: "Vonage to +44 7700 900123",
    body: "Your order is on its way",
    status: "sent",
    tone: "info",
  },
  {
    sender: "WhatsApp to +880 1700 000000",
    body: "Your table is booked for 8 pm",
    status: "read",
    tone: "success",
  },
  {
    sender: "Twilio Verify",
    body: "Code 615204 approved",
    status: "approved",
    tone: "success",
  },
];

/** Text messages arriving one by one, like notifications on a phone. */
export function SmsVisual() {
  return (
    <VisualFrame className="px-4 pt-4">
      <AnimatedList delay={1600} className="gap-2">
        {caughtTextMessages.map((textMessage) => (
          <SceneCard key={textMessage.body} className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-(--brand-from) to-(--brand-to) text-white">
              <MessageSquareIcon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {textMessage.sender}
              </span>
              <span className="block truncate text-fd-muted-foreground">
                {textMessage.body}
              </span>
            </span>
            <StatusPill tone={textMessage.tone}>
              {textMessage.status}
            </StatusPill>
          </SceneCard>
        ))}
      </AnimatedList>
    </VisualFrame>
  );
}

const webhookDeliveries: {
  event: string;
  status: string;
  tone: StatusTone;
  note: string;
}[] = [
  {
    event: "email.bounced",
    status: "200",
    tone: "success",
    note: "42 ms",
  },
  {
    event: "sms.delivered",
    status: "500",
    tone: "error",
    note: "retry in 8 s",
  },
  {
    event: "payment.succeeded",
    status: "200",
    tone: "success",
    note: "replayed",
  },
];

/** A delivery log: each event, the answer, and the retry or replay. */
export function WebhooksVisual() {
  return (
    <VisualFrame className="flex flex-col gap-1.5 px-4 pt-2">
      {webhookDeliveries.map((webhookDelivery) => (
        <SceneCard
          key={webhookDelivery.event}
          className="flex items-center gap-2 font-mono"
        >
          <StatusPill tone={webhookDelivery.tone}>
            {webhookDelivery.status}
          </StatusPill>
          <span className="min-w-0 flex-1 truncate">
            {webhookDelivery.event}
          </span>
          <span className="shrink-0 text-fd-muted-foreground">
            {webhookDelivery.note}
          </span>
        </SceneCard>
      ))}
    </VisualFrame>
  );
}
