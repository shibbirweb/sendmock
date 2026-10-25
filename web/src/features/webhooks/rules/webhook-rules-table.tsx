import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

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
import type { WebhookRule } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { describeRuleFilter } from "@/lib/webhooks/rule-filter/describe-rule-filter";

export type RuleRowActions = {
  onMove: (webhookRule: WebhookRule, direction: "up" | "down") => void;
  onToggleEnabled: (webhookRule: WebhookRule, isEnabled: boolean) => void;
  onEdit: (webhookRule: WebhookRule) => void;
  onDelete: (webhookRule: WebhookRule) => void;
};

function RuleRow({
  webhookRule,
  endpointName,
  isFirst,
  isLast,
  canReorder,
  rowActions,
}: {
  webhookRule: WebhookRule;
  endpointName: string;
  isFirst: boolean;
  isLast: boolean;
  canReorder: boolean;
  rowActions: RuleRowActions;
}) {
  return (
    <TableRow
      className={cn(!webhookRule.is_enabled && "text-muted-foreground")}
    >
      <TableCell className="w-0">
        <span className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${webhookRule.name} up`}
            disabled={!canReorder || isFirst}
            onClick={() => {
              rowActions.onMove(webhookRule, "up");
            }}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${webhookRule.name} down`}
            disabled={!canReorder || isLast}
            onClick={() => {
              rowActions.onMove(webhookRule, "down");
            }}
          >
            <ArrowDownIcon />
          </Button>
        </span>
      </TableCell>
      <TableCell className="max-w-56">
        <span className="block truncate font-medium">{webhookRule.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          to {endpointName}
        </span>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="flex max-w-64 flex-wrap gap-1">
          {webhookRule.events.map((eventType) => (
            <span
              key={eventType}
              className="rounded border px-1 font-mono text-[11px]"
            >
              {eventType}
            </span>
          ))}
        </span>
      </TableCell>
      <TableCell className="hidden max-w-80 lg:table-cell">
        <span data-testid="filter-summary" className="line-clamp-2 text-xs">
          {describeRuleFilter(webhookRule.filter)}
        </span>
      </TableCell>
      <TableCell>
        <Switch
          aria-label={`${webhookRule.name} enabled`}
          checked={webhookRule.is_enabled}
          onCheckedChange={(isEnabled) => {
            rowActions.onToggleEnabled(webhookRule, isEnabled);
          }}
        />
      </TableCell>
      <TableCell className="w-0">
        <span className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${webhookRule.name}`}
            onClick={() => {
              rowActions.onEdit(webhookRule);
            }}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${webhookRule.name}`}
            onClick={() => {
              rowActions.onDelete(webhookRule);
            }}
          >
            <Trash2Icon />
          </Button>
        </span>
      </TableCell>
    </TableRow>
  );
}

/** Rules in firing order with event chips and filter summaries (WH-02.6). */
export function WebhookRulesTable({
  webhookRules,
  endpointNamesById,
  canReorder,
  rowActions,
}: {
  webhookRules: WebhookRule[];
  endpointNamesById: Map<string, string>;
  /** Reordering is off while the list is filtered, so neighbours are real. */
  canReorder: boolean;
  rowActions: RuleRowActions;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-0">Order</TableHead>
          <TableHead>Rule</TableHead>
          <TableHead className="hidden md:table-cell">Events</TableHead>
          <TableHead className="hidden lg:table-cell">Filter</TableHead>
          <TableHead>On</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {webhookRules.map((webhookRule, ruleIndex) => (
          <RuleRow
            key={webhookRule.id}
            webhookRule={webhookRule}
            endpointName={
              endpointNamesById.get(webhookRule.endpoint_id) ??
              "a deleted endpoint"
            }
            isFirst={ruleIndex === 0}
            isLast={ruleIndex === webhookRules.length - 1}
            canReorder={canReorder}
            rowActions={rowActions}
          />
        ))}
      </TableBody>
    </Table>
  );
}
