import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatLatencyMs,
  formatPercent,
} from "@/features/overview/format-overview-values";
import type { WebhookMetrics } from "@/lib/api/types";

const metricTiles: {
  title: string;
  readValue: (webhookMetrics: WebhookMetrics) => string;
}[] = [
  {
    title: "Deliveries",
    readValue: (webhookMetrics) => String(webhookMetrics.delivery_count),
  },
  {
    title: "Success rate",
    readValue: (webhookMetrics) => formatPercent(webhookMetrics.success_rate),
  },
  {
    title: "p50 / p95 latency",
    readValue: (webhookMetrics) =>
      `${formatLatencyMs(webhookMetrics.p50_latency_ms)} / ${formatLatencyMs(webhookMetrics.p95_latency_ms)}`,
  },
  {
    title: "Retries",
    readValue: (webhookMetrics) => String(webhookMetrics.retry_count),
  },
  {
    title: "Render failures",
    readValue: (webhookMetrics) => String(webhookMetrics.render_failed_count),
  },
];

/** The range's totals as stat tiles (WH-11.3). */
export function WebhookMetricTiles({
  webhookMetrics,
}: {
  webhookMetrics: WebhookMetrics;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {metricTiles.map((metricTile) => (
        <Card key={metricTile.title} className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {metricTile.title}
            </CardTitle>
          </CardHeader>
          <CardContent
            data-testid="metric-tile-value"
            className="px-4 text-xl font-semibold tabular-nums"
          >
            {metricTile.readValue(webhookMetrics)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
