import {
  BotIcon,
  ContainerIcon,
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
  DistributionVisual,
  HttpCatcherVisual,
  PaymentsVisual,
} from "./feature-visuals/tool-visuals";

const featureCards = [
  {
    name: "Email",
    description:
      "SMTP and SendGrid, Mailgun, Postmark, Resend, SES and Brevo compatible APIs. HTML preview, checks, bounces and opens.",
    Icon: MailIcon,
    href: "/docs/mail",
    cta: "Email docs",
    Visual: EmailVisual,
    className: "lg:col-span-2",
  },
  {
    name: "SMS and Verify",
    description:
      "Twilio and Vonage compatible APIs, Twilio Verify, real test numbers and delivery status callbacks.",
    Icon: MessageSquareIcon,
    href: "/docs/sms",
    cta: "SMS docs",
    Visual: SmsVisual,
    className: "lg:col-span-1",
  },
  {
    name: "Webhooks",
    description:
      "Automatic rules or manual sends, provider-shaped templates, variables, retries, replay and Standard Webhooks signing.",
    Icon: WebhookIcon,
    href: "/docs/webhooks",
    cta: "Webhook docs",
    Visual: WebhooksVisual,
    className: "lg:col-span-1",
  },
  {
    name: "Payments",
    description:
      "Stripe, PayPal, SSLCommerz and bKash test checkouts with real redirects, IPNs and signatures. Test cards, wallets and your own flows.",
    Icon: CreditCardIcon,
    href: "/docs/payments",
    cta: "Payment docs",
    Visual: PaymentsVisual,
    className: "lg:col-span-2",
  },
  {
    name: "HTTP Catcher",
    description:
      "A bin for any HTTP call your app makes, with response rules, delays and failures you set.",
    Icon: GlobeIcon,
    href: "/docs/http",
    cta: "HTTP Catcher docs",
    Visual: HttpCatcherVisual,
    className: "lg:col-span-1",
  },
  {
    name: "Built for AI agents",
    description:
      "A full CLI, an MCP server and an agent skill, so Claude Code, Codex and others can set up and test everything.",
    Icon: BotIcon,
    href: "/docs/ai",
    cta: "AI docs",
    Visual: AiAgentsVisual,
    className: "lg:col-span-1",
  },
  {
    name: "One binary or Docker",
    description:
      "macOS, Linux and Windows binaries, plus a tiny multi-arch Docker image.",
    Icon: ContainerIcon,
    href: "/docs/install",
    cta: "Install",
    Visual: DistributionVisual,
    className: "lg:col-span-1",
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
        className="auto-rows-[22rem] lg:grid-cols-3"
      >
        {featureCards.map(({ Visual, ...featureCard }) => (
          <BentoCard
            key={featureCard.name}
            {...featureCard}
            background={<Visual />}
          />
        ))}
      </BentoGrid>
    </section>
  );
}
