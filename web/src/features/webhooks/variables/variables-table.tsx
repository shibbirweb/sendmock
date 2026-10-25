import { Link } from "@tanstack/react-router";
import { PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { variableKindLabels } from "@/features/webhooks/variables/variable-kinds";
import type { WebhookVariable } from "@/lib/api/types";

export type VariableRowActions = {
  onEdit: (webhookVariable: WebhookVariable) => void;
  onDelete: (webhookVariable: WebhookVariable) => void;
  onRegenerate: (webhookVariable: WebhookVariable) => void;
};

function isFixedRandom(webhookVariable: WebhookVariable): boolean {
  return (
    webhookVariable.kind === "random" && webhookVariable.random_mode === "fixed"
  );
}

function VariableValueCell({
  webhookVariable,
}: {
  webhookVariable: WebhookVariable;
}) {
  return (
    <span className="grid min-w-0 gap-0.5">
      <code
        className="truncate font-mono text-xs"
        title={webhookVariable.value}
      >
        {webhookVariable.value || "(empty)"}
      </code>
      {webhookVariable.kind === "random" && (
        <span className="text-[11px] text-muted-foreground">
          {isFixedRandom(webhookVariable)
            ? `Fixed: ${webhookVariable.fixed_value ?? ""}`
            : "New value per send"}
        </span>
      )}
    </span>
  );
}

/** Global and endpoint variables with kind, value and scope (WH-07.11). */
export function VariablesTable({
  webhookVariables,
  endpointNamesById,
  rowActions,
}: {
  webhookVariables: WebhookVariable[];
  endpointNamesById: Map<string, string>;
  rowActions: VariableRowActions;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="hidden sm:table-cell">Kind</TableHead>
          <TableHead>Value</TableHead>
          <TableHead className="hidden md:table-cell">Scope</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {webhookVariables.map((webhookVariable) => (
          <TableRow key={webhookVariable.id}>
            <TableCell className="max-w-56">
              <code className="block truncate font-mono text-xs font-medium">
                vars.{webhookVariable.name}
              </code>
              <span className="block text-[11px] text-muted-foreground sm:hidden">
                {variableKindLabels[webhookVariable.kind]}
              </span>
              {webhookVariable.description !== "" && (
                <span className="block truncate text-xs text-muted-foreground">
                  {webhookVariable.description}
                </span>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Badge variant="outline">
                {variableKindLabels[webhookVariable.kind]}
              </Badge>
            </TableCell>
            <TableCell className="max-w-64">
              <VariableValueCell webhookVariable={webhookVariable} />
            </TableCell>
            <TableCell className="hidden text-sm md:table-cell">
              {webhookVariable.endpoint_id === null ? (
                "Global"
              ) : (
                <Link
                  to="/webhooks/variables"
                  search={{ endpoint: webhookVariable.endpoint_id }}
                  className="underline-offset-4 hover:underline"
                >
                  {endpointNamesById.get(webhookVariable.endpoint_id) ??
                    "Deleted endpoint"}
                </Link>
              )}
            </TableCell>
            <TableCell>
              <span className="flex justify-end gap-0.5">
                {isFixedRandom(webhookVariable) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Regenerate ${webhookVariable.name}`}
                    onClick={() => {
                      rowActions.onRegenerate(webhookVariable);
                    }}
                  >
                    <RefreshCwIcon />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${webhookVariable.name}`}
                  onClick={() => {
                    rowActions.onEdit(webhookVariable);
                  }}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${webhookVariable.name}`}
                  onClick={() => {
                    rowActions.onDelete(webhookVariable);
                  }}
                >
                  <Trash2Icon />
                </Button>
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
