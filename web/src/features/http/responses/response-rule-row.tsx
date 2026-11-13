import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { IconButton } from "@/components/common/icon-button";
import { Switch } from "@/components/ui/switch";
import type { HttpResponseRule } from "@/lib/api/types";
import { describeResponseRule } from "@/lib/http/describe-response-rule";
import { cn } from "@/lib/utils";

/** One rule in firing order: position, name, summary and its actions. */
export function ResponseRuleRow({
  responseRule,
  position,
  isFirst,
  isLast,
  onMove,
  onToggle,
  onEdit,
  onDelete,
}: {
  responseRule: HttpResponseRule;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (step: -1 | 1) => void;
  onToggle: (isEnabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      data-testid="response-rule"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border p-3",
        !responseRule.is_enabled && "opacity-60",
      )}
    >
      <span className="w-5 text-center text-xs text-muted-foreground tabular-nums">
        {position}
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="truncate text-sm font-medium">{responseRule.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {describeResponseRule(responseRule)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={`Move ${responseRule.name} up`}
          disabled={isFirst}
          onClick={() => {
            onMove(-1);
          }}
        >
          <ArrowUpIcon />
        </IconButton>
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={`Move ${responseRule.name} down`}
          disabled={isLast}
          onClick={() => {
            onMove(1);
          }}
        >
          <ArrowDownIcon />
        </IconButton>
        <Switch
          aria-label={`${responseRule.name} enabled`}
          checked={responseRule.is_enabled}
          onCheckedChange={onToggle}
        />
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={`Edit ${responseRule.name}`}
          onClick={onEdit}
        >
          <PencilIcon />
        </IconButton>
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={`Delete ${responseRule.name}`}
          onClick={onDelete}
        >
          <Trash2Icon />
        </IconButton>
      </div>
    </li>
  );
}
