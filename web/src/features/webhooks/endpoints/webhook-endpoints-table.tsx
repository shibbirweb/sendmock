import { ContainerIcon, PencilIcon, SendIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsDockerLoopbackUrl } from "@/features/webhooks/endpoints/docker-host-hint";
import { SuccessSparkline } from "@/features/webhooks/endpoints/success-sparkline";
import type { WebhookEndpoint } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export type EndpointRowActions = {
  onToggleEnabled: (
    webhookEndpoint: WebhookEndpoint,
    isEnabled: boolean,
  ) => void;
  onSendTest: (webhookEndpoint: WebhookEndpoint) => void;
  onEdit: (webhookEndpoint: WebhookEndpoint) => void;
  onDelete: (webhookEndpoint: WebhookEndpoint) => void;
};

const dockerLoopbackHint =
  "localhost is the container itself in Docker; use host.docker.internal";

function formatSuccessRate(successRate: number | null): string {
  return successRate === null ? "n/a" : `${Math.round(successRate * 100)}%`;
}

function EndpointUrlCell({
  webhookEndpoint,
}: {
  webhookEndpoint: WebhookEndpoint;
}) {
  const isDockerLoopbackUrl = useIsDockerLoopbackUrl(webhookEndpoint.url);

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="rounded border px-1 font-mono text-[10px]">
        {webhookEndpoint.method}
      </span>
      <span
        className="min-w-0 truncate font-mono text-xs"
        title={webhookEndpoint.url}
      >
        {webhookEndpoint.url}
      </span>
      {isDockerLoopbackUrl && (
        <span
          role="img"
          aria-label={dockerLoopbackHint}
          title={dockerLoopbackHint}
          className="shrink-0 text-muted-foreground"
        >
          <ContainerIcon aria-hidden="true" className="size-3.5" />
        </span>
      )}
    </span>
  );
}

function EndpointRow({
  webhookEndpoint,
  templateName,
  rowActions,
}: {
  webhookEndpoint: WebhookEndpoint;
  templateName: string;
  rowActions: EndpointRowActions;
}) {
  return (
    <TableRow
      className={cn(!webhookEndpoint.is_enabled && "text-muted-foreground")}
    >
      <TableCell className="max-w-48 font-medium">
        <span className="block truncate">{webhookEndpoint.name}</span>
        <span className="block truncate font-mono text-[11px] font-normal text-muted-foreground md:hidden">
          {webhookEndpoint.url}
        </span>
      </TableCell>
      <TableCell className="hidden max-w-72 md:table-cell">
        <EndpointUrlCell webhookEndpoint={webhookEndpoint} />
      </TableCell>
      <TableCell className="hidden max-w-48 truncate lg:table-cell">
        {templateName}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">
        {webhookEndpoint.delivery_count_24h}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="flex items-center gap-2">
          <SuccessSparkline successHistory={webhookEndpoint.success_history} />
          <span className="w-9 text-right text-xs tabular-nums">
            {formatSuccessRate(webhookEndpoint.success_rate)}
          </span>
        </span>
      </TableCell>
      <TableCell>
        <Switch
          aria-label={`${webhookEndpoint.name} enabled`}
          checked={webhookEndpoint.is_enabled}
          onCheckedChange={(isEnabled) => {
            rowActions.onToggleEnabled(webhookEndpoint, isEnabled);
          }}
        />
      </TableCell>
      <TableCell>
        <span className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Send test to ${webhookEndpoint.name}`}
            onClick={() => {
              rowActions.onSendTest(webhookEndpoint);
            }}
          >
            <SendIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${webhookEndpoint.name}`}
            onClick={() => {
              rowActions.onEdit(webhookEndpoint);
            }}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${webhookEndpoint.name}`}
            onClick={() => {
              rowActions.onDelete(webhookEndpoint);
            }}
          >
            <Trash2Icon />
          </Button>
        </span>
      </TableCell>
    </TableRow>
  );
}

/** Endpoints with their 24-hour health and quick actions (WH-01.7). */
export function WebhookEndpointsTable({
  webhookEndpoints,
  templateNamesById,
  rowActions,
}: {
  webhookEndpoints: WebhookEndpoint[];
  templateNamesById: Map<string, string>;
  rowActions: EndpointRowActions;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="hidden md:table-cell">URL</TableHead>
          <TableHead className="hidden lg:table-cell">Template</TableHead>
          <TableHead className="hidden text-right md:table-cell">
            24 h
          </TableHead>
          <TableHead className="hidden sm:table-cell">Success, 24 h</TableHead>
          <TableHead>On</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {webhookEndpoints.map((webhookEndpoint) => (
          <EndpointRow
            key={webhookEndpoint.id}
            webhookEndpoint={webhookEndpoint}
            templateName={
              templateNamesById.get(webhookEndpoint.template_id) ??
              webhookEndpoint.template_id
            }
            rowActions={rowActions}
          />
        ))}
      </TableBody>
    </Table>
  );
}
