import { Link } from "@tanstack/react-router";
import {
  GlobeIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  WebhookIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/features/overview/format-overview-values";
import type { AppStats } from "@/lib/api/types";
import { formatMinorAmount } from "@/lib/payments/format-money";

type StatTileDefinition = {
  title: string;
  path: string;
  icon: LucideIcon;
  readValue: (appStats: AppStats) => string;
  readDetail: (appStats: AppStats) => string;
  /** A second detail line, e.g. revenue per currency. */
  readNote?: (appStats: AppStats) => string;
};

/** "USD 120.00, BDT 4,600.00" for the two largest currencies (PY-09.5). */
function describeRevenue(appStats: AppStats): string {
  const revenueParts = appStats.payment_revenue
    .slice(0, 2)
    .map((revenue) =>
      formatMinorAmount(revenue.amount_minor, revenue.currency),
    );

  return revenueParts.length === 0
    ? "No revenue yet"
    : `${revenueParts.join(", ")} (test)`;
}

const statTileDefinitions: StatTileDefinition[] = [
  {
    title: "Emails",
    path: "/mail",
    icon: MailIcon,
    readValue: (appStats) => String(appStats.email_count),
    readDetail: (appStats) =>
      `${appStats.emails_today} today, ${appStats.unread_email_count} unread`,
  },
  {
    title: "SMS",
    path: "/sms",
    icon: MessageSquareIcon,
    readValue: (appStats) => String(appStats.sms_count),
    readDetail: (appStats) =>
      `${appStats.sms_today} today, ${appStats.unread_sms_count} inbound`,
  },
  {
    title: "Verifications",
    path: "/sms/verify",
    icon: ShieldCheckIcon,
    readValue: (appStats) => String(appStats.verification_count),
    readDetail: (appStats) => `${appStats.pending_verification_count} pending`,
  },
  {
    title: "HTTP requests",
    path: "/http",
    icon: GlobeIcon,
    readValue: (appStats) => String(appStats.http_request_count),
    readDetail: (appStats) => `${appStats.http_requests_today} today`,
  },
  {
    title: "Webhook success",
    path: "/webhooks/deliveries",
    icon: WebhookIcon,
    readValue: (appStats) => formatPercent(appStats.webhook_success_rate),
    readDetail: (appStats) =>
      `${appStats.webhook_delivery_count} deliveries, p95 ${appStats.webhook_p95_latency_ms ?? "n/a"} ms`,
  },
  {
    title: "Payments",
    path: "/payments",
    icon: ReceiptIcon,
    readValue: (appStats) => String(appStats.payment_count),
    readDetail: (appStats) =>
      `${appStats.payments_today} today, ${formatPercent(appStats.payment_success_rate)} succeeded`,
    readNote: describeRevenue,
  },
];

/** Totals and today's counts, each linking to its screen (UI-03.5, PY-09.5). */
export function OverviewStatTiles({ appStats }: { appStats: AppStats }) {
  return (
    <ul
      aria-label="Totals"
      className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6"
    >
      {statTileDefinitions.map((statTileDefinition) => (
        <li key={statTileDefinition.title}>
          <Link
            to={statTileDefinition.path}
            className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Card className="h-full gap-2 transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {statTileDefinition.title}
                </CardTitle>
                <statTileDefinition.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="grid gap-1">
                <span className="text-2xl font-semibold tabular-nums">
                  {statTileDefinition.readValue(appStats)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {statTileDefinition.readDetail(appStats)}
                </span>
                {statTileDefinition.readNote !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {statTileDefinition.readNote(appStats)}
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
