import { Link } from "@tanstack/react-router";
import {
  GlobeIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  WebhookIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStats } from "@/lib/api/hooks/use-system-queries";
import type { AppStats } from "@/lib/api/types";

type StatCardDefinition = {
  title: string;
  path: string;
  icon: LucideIcon;
  readValue: (appStats: AppStats) => string;
  readDetail: (appStats: AppStats) => string;
};

function formatPercent(rate: number | null): string {
  return rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
}

const statCardDefinitions: StatCardDefinition[] = [
  {
    title: "Emails",
    path: "/mail",
    icon: MailIcon,
    readValue: (appStats) => String(appStats.email_count),
    readDetail: (appStats) => `${appStats.unread_email_count} unread`,
  },
  {
    title: "SMS",
    path: "/sms",
    icon: MessageSquareIcon,
    readValue: (appStats) => String(appStats.sms_count),
    readDetail: (appStats) => `${appStats.unread_sms_count} inbound`,
  },
  {
    title: "Verifications",
    path: "/sms/verify",
    icon: ShieldCheckIcon,
    readValue: (appStats) => String(appStats.verification_count),
    readDetail: () => "Twilio Verify",
  },
  {
    title: "HTTP requests",
    path: "/http",
    icon: GlobeIcon,
    readValue: (appStats) => String(appStats.http_request_count),
    readDetail: () => "Captured by the catcher",
  },
  {
    title: "Webhook success",
    path: "/webhooks/deliveries",
    icon: WebhookIcon,
    readValue: (appStats) => formatPercent(appStats.webhook_success_rate),
    readDetail: (appStats) =>
      `${appStats.webhook_delivery_count} deliveries, p95 ${appStats.webhook_p95_latency_ms ?? "n/a"} ms`,
  },
];

/** Live counters on the overview; they refresh on every realtime event. */
export function OverviewStatCards() {
  const { data: appStats, isPending, isError } = useAppStats();

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load the overview. Check that SendMock is running.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {statCardDefinitions.map((statCardDefinition) => (
        <Link key={statCardDefinition.title} to={statCardDefinition.path}>
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {statCardDefinition.title}
              </CardTitle>
              <statCardDefinition.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="grid gap-1">
              {isPending ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <span className="text-2xl font-semibold tabular-nums">
                  {statCardDefinition.readValue(appStats)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {isPending
                  ? "Loading..."
                  : statCardDefinition.readDetail(appStats)}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
