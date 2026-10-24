import {
  BotIcon,
  ContainerIcon,
  MailIcon,
  MessageSquareIcon,
  WebhookIcon,
} from "lucide-react";

import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";

const featureCards = [
  {
    name: "Email",
    description:
      "SMTP and SendGrid, Mailgun, Postmark, Resend, SES and Brevo compatible APIs. HTML preview, checks, bounces and opens.",
    Icon: MailIcon,
    href: "/docs",
    cta: "Email docs",
    className: "lg:col-span-2",
  },
  {
    name: "SMS and Verify",
    description:
      "Twilio and Vonage compatible APIs, Twilio Verify, real test numbers and delivery status callbacks.",
    Icon: MessageSquareIcon,
    href: "/docs",
    cta: "SMS docs",
    className: "lg:col-span-1",
  },
  {
    name: "Webhooks",
    description:
      "Automatic rules or manual sends, provider-shaped templates, variables, retries, replay and Standard Webhooks signing.",
    Icon: WebhookIcon,
    href: "/docs",
    cta: "Webhook docs",
    className: "lg:col-span-1",
  },
  {
    name: "Built for AI agents",
    description:
      "A full CLI, an MCP server and an agent skill, so Claude Code, Codex and others can set up and test everything.",
    Icon: BotIcon,
    href: "/docs",
    cta: "AI docs",
    className: "lg:col-span-1",
  },
  {
    name: "One binary or Docker",
    description:
      "macOS, Linux and Windows binaries, plus a tiny multi-arch Docker image.",
    Icon: ContainerIcon,
    href: "/docs",
    cta: "Install",
    className: "lg:col-span-1",
  },
];

export function FeaturesSection() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16">
      <h2 className="text-center text-2xl font-semibold">Everything in one place</h2>
      <BentoGrid className="lg:grid-cols-3">
        {featureCards.map((featureCard) => (
          <BentoCard
            key={featureCard.name}
            {...featureCard}
            background={<div className="absolute inset-0 bg-gradient-to-br from-fd-primary/5 to-transparent" />}
          />
        ))}
      </BentoGrid>
    </section>
  );
}
