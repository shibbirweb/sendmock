import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";

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
import { messageRuleLabels } from "@/features/settings/message-rules/message-rule-labels";
import { MessageRuleSheet } from "@/features/settings/message-rules/message-rule-sheet";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import {
  type MessageRuleKind,
  type MessageRuleTypes,
  useDeleteMessageRule,
  useMessageRules,
  useMoveMessageRule,
  useSaveMessageRule,
} from "@/lib/api/hooks/use-message-rule-queries";
import { describeRuleFilter } from "@/lib/webhooks/rule-filter/describe-rule-filter";

type StoredRule = MessageRuleTypes[MessageRuleKind]["rule"];

function describeRuleAction(messageRule: StoredRule): string {
  return "tag" in messageRule ? messageRule.tag : messageRule.to.join(", ");
}

/** Tag rules or auto-forward rules: ordered, switchable, edited in a sheet (EM-12.3, EM-14.3). */
export function MessageRulesCard({ ruleKind }: { ruleKind: MessageRuleKind }) {
  const ruleLabels = messageRuleLabels[ruleKind];
  const rulesQuery = useMessageRules(ruleKind);
  const saveMessageRule = useSaveMessageRule(ruleKind);
  const moveMessageRule = useMoveMessageRule(ruleKind);
  const deleteMessageRule = useDeleteMessageRule(ruleKind);
  const [editedRule, setEditedRule] = React.useState<StoredRule | null>(null);
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [deletedRule, setDeletedRule] = React.useState<StoredRule | null>(null);
  const messageRules: StoredRule[] = rulesQuery.data ?? [];

  const openSheet = (messageRule: StoredRule | null) => {
    setEditedRule(messageRule);
    setSheetOpen(true);
  };

  return (
    <SettingsSectionCard
      title={ruleLabels.cardTitle}
      description={ruleLabels.cardDescription}
    >
      {messageRules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ruleLabels.emptyText}</p>
      ) : (
        <Table aria-label={ruleLabels.cardTitle}>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>When</TableHead>
              <TableHead>{ruleLabels.actionHeading}</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messageRules.map((messageRule, ruleIndex) => (
              <TableRow key={messageRule.id} data-testid="message-rule-row">
                <TableCell className="font-medium">
                  {messageRule.name}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {describeRuleFilter(messageRule.filter)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {describeRuleAction(messageRule)}
                </TableCell>
                <TableCell>
                  <Switch
                    aria-label={`${messageRule.name} enabled`}
                    checked={messageRule.is_enabled}
                    onCheckedChange={(isEnabled) => {
                      saveMessageRule.mutate({
                        ruleId: messageRule.id,
                        ruleInput: { is_enabled: isEnabled },
                      });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${messageRule.name} up`}
                      disabled={ruleIndex === 0}
                      onClick={() => {
                        moveMessageRule.mutate({
                          ruleId: messageRule.id,
                          direction: "up",
                        });
                      }}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${messageRule.name} down`}
                      disabled={ruleIndex === messageRules.length - 1}
                      onClick={() => {
                        moveMessageRule.mutate({
                          ruleId: messageRule.id,
                          direction: "down",
                        });
                      }}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${messageRule.name}`}
                      onClick={() => openSheet(messageRule)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${messageRule.name}`}
                      onClick={() => setDeletedRule(messageRule)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openSheet(null)}
        >
          <PlusIcon />
          Add rule
        </Button>
      </div>
      <MessageRuleSheet
        ruleKind={ruleKind}
        isOpen={isSheetOpen}
        editedRule={editedRule}
        onOpenChange={setSheetOpen}
      />
      <ConfirmDeleteDialog
        itemName={deletedRule?.name ?? null}
        consequence="Emails that arrive from now on are no longer changed by it."
        onConfirm={() => {
          if (deletedRule !== null) {
            deleteMessageRule.mutate(deletedRule.id);
          }
          setDeletedRule(null);
        }}
        onClose={() => setDeletedRule(null)}
      />
    </SettingsSectionCard>
  );
}
