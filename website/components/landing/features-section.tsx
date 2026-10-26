import {
  BotIcon,
  CreditCardIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareIcon,
  WebhookIcon,
} from "lucide-react";

import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";

import {
  EmailVisual,
  SmsVisual,
  WebhooksVisual,
} from "./feature-visuals/message-visuals";
import {
  AiAgentsVisual,
  HttpCatcherVisual,
  PaymentsVisual,
} from "./feature-visuals/tool-visuals";

const featureCards = [
  {
    name: "Email",
    description:
      "SMTP plus SendGrid, Mailgun, Postmark, Resend, SES and Brevo APIs, with HTML preview and checks.",
    Icon: MailIcon,
    href: "/docs/mail",
    cta: "Email docs",
    Visual: EmailVisual,
  },
  {
    name: "SMS and Verify",
    description:
      "Twilio and Vonage compatible APIs, Twilio Verify, real test numbers and delivery status callbacks.",
    Icon: MessageSquareIcon,
    href: "/docs/sms",
    cta: "SMS docs",
    Visual: SmsVisual,
  },
  {
    name: "Webhooks",
    description:
      "Rules or manual sends, provider-shaped templates, retries, replay and Standard Webhooks signing.",
    Icon: WebhookIcon,
    href: "/docs/webhooks",
    cta: "Webhook docs",
    Visual: WebhooksVisual,
  },
  {
    name: "Payments",
    description:
      "Stripe, PayPal, SSLCommerz and bKash test checkouts with real redirects, signed IPNs and test cards.",
    Icon: CreditCardIcon,
    href: "/docs/payments",
    cta: "Payment docs",
    Visual: PaymentsVisual,
  },
  {
    name: "HTTP Catcher",
    description:
      "A bin for any HTTP call your app makes, answered with the responses, delays and failures you set.",
    Icon: GlobeIcon,
    href: "/docs/http",
    cta: "HTTP Catcher docs",
    Visual: HttpCatcherVisual,
  },
  {
    name: "Built for AI agents",
    description:
      "A CLI, an MCP server and an agent skill, so Claude Code, Codex and others can test everything.",
    Icon: BotIcon,
    href: "/docs/ai",
    cta: "AI docs",
    Visual: AiAgentsVisual,
  },
];

export function FeaturesSection() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-20"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-semibold tracking-wide text-(--brand-from) uppercase">
          Features
        </p>
        <h2
          id="features-heading"
          className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl"
        >
          Everything in one place
        </h2>
        <p className="max-w-2xl text-fd-muted-foreground sm:text-lg">
          Every email, SMS, payment, webhook and HTTP call your app makes,
          caught and answered like the real provider, on your own machine.
        </p>
      </div>
      <BentoGrid
        data-testid="features-bento"
        className="auto-rows-auto lg:grid-cols-3"
      >
        {featureCards.map(({ Visual, ...featureCard }) => (
          <BentoCard
            key={featureCard.name}
            {...featureCard}
            className="lg:col-span-1"
            background={<Visual />}
          />
        ))}
      </BentoGrid>
    </section>
  );
}
