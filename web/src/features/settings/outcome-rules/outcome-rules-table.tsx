import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
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
import {
  type OutcomeRuleKind,
  useDeleteOutcomeRule,
  useMoveOutcomeRule,
  useToggleOutcomeRule,
} from "@/lib/api/hooks/use-outcome-rule-queries";
import { cn } from "@/lib/utils";

export type OutcomeRuleRow = {
  ruleId: string;
  position: number;
  /** "To" / "From" for numbers; null for addresses. */
  matchLabel: string | null;
  pattern: string;
  outcomeText: string;
  note: string;
  isEnabled: boolean;
};

/** Ordered custom rules with on / off, move, edit and delete (SM-07.7, EM-10.5). */
export function OutcomeRulesTable({
  ruleKind,
  ruleRows,
  onEdit,
}: {
  ruleKind: OutcomeRuleKind;
  ruleRows: OutcomeRuleRow[];
  onEdit: (ruleId: string) => void;
}) {
  const toggleOutcomeRule = useToggleOutcomeRule(ruleKind);
  const moveOutcomeRule = useMoveOutcomeRule(ruleKind);
  const deleteOutcomeRule = useDeleteOutcomeRule(ruleKind);
  const [deletedRow, setDeletedRow] = React.useState<OutcomeRuleRow | null>(
    null,
  );
  const hasMatchColumn = ruleRows.some(
    (ruleRow) => ruleRow.matchLabel !== null,
  );

  return (
    <div className="min-w-0 rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>{hasMatchColumn ? "Number" : "Address"}</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="w-0">On</TableHead>
            <TableHead className="w-0">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ruleRows.map((ruleRow, rowIndex) => (
            <TableRow
              key={ruleRow.ruleId}
              className={cn(!ruleRow.isEnabled && "text-muted-foreground")}
            >
              <TableCell className="tabular-nums">{ruleRow.position}</TableCell>
              <TableCell className="max-w-56">
                <span className="grid min-w-0">
                  <span className="truncate font-mono text-xs">
                    {ruleRow.matchLabel !== null && (
                      <span className="mr-1 rounded border px-1 font-sans text-[10px] uppercase">
                        {ruleRow.matchLabel}
                      </span>
                    )}
                    {ruleRow.pattern}
                  </span>
                  {ruleRow.note !== "" && (
                    <span className="truncate text-xs text-muted-foreground">
                      {ruleRow.note}
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="whitespace-normal">
                {ruleRow.outcomeText}
              </TableCell>
              <TableCell>
                <Switch
                  aria-label={`Rule ${ruleRow.position} enabled`}
                  checked={ruleRow.isEnabled}
                  onCheckedChange={(isEnabled) =>
                    toggleOutcomeRule.mutate({
                      ruleId: ruleRow.ruleId,
                      isEnabled,
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <span className="flex justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move rule ${ruleRow.position} up`}
                    disabled={rowIndex === 0}
                    onClick={() =>
                      moveOutcomeRule.mutate({
                        ruleId: ruleRow.ruleId,
                        direction: "up",
                      })
                    }
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move rule ${ruleRow.position} down`}
                    disabled={rowIndex === ruleRows.length - 1}
                    onClick={() =>
                      moveOutcomeRule.mutate({
                        ruleId: ruleRow.ruleId,
                        direction: "down",
                      })
                    }
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit rule ${ruleRow.position}`}
                    onClick={() => onEdit(ruleRow.ruleId)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete rule ${ruleRow.position}`}
                    onClick={() => setDeletedRow(ruleRow)}
                  >
                    <Trash2Icon />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDeleteDialog
        itemName={
          deletedRow === null
            ? null
            : `rule ${deletedRow.position} (${deletedRow.pattern})`
        }
        consequence="Matching messages go back to the magic numbers or the simulation profile."
        onConfirm={() => {
          if (deletedRow === null) {
            return;
          }

          deleteOutcomeRule.mutate(deletedRow.ruleId, {
            onSuccess: () => {
              toast("Rule deleted");
            },
          });
        }}
        onClose={() => setDeletedRow(null)}
      />
    </div>
  );
}
