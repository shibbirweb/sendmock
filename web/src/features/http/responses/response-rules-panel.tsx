import { PencilIcon, PlusIcon } from "lucide-react";
import * as React from "react";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DefaultReplySheet } from "@/features/http/responses/default-reply-sheet";
import { ResponseRuleRow } from "@/features/http/responses/response-rule-row";
import { ResponseRuleSheet } from "@/features/http/responses/response-rule-sheet";
import { useResponseRuleList } from "@/features/http/responses/use-response-rule-list";
import type { HttpBin } from "@/lib/api/types";

/** A bin's response rules in firing order and its default reply (HC-02.1, HC-02.4). */
export function ResponseRulesPanel({ httpBin }: { httpBin: HttpBin }) {
  const ruleList = useResponseRuleList(httpBin.id);
  const [isDefaultReplyOpen, setDefaultReplyOpen] = React.useState(false);
  const { responseRules } = ruleList;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-4xl gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Rules are checked in order; the first enabled match answers.
          </p>
          <Button
            size="sm"
            onClick={() => {
              ruleList.openEditor(null);
            }}
          >
            <PlusIcon />
            Add rule
          </Button>
        </div>
        {ruleList.rulesQuery.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : responseRules.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No rules yet: every request gets the default reply. Add one to
            answer some requests differently, slowly or with errors.
          </p>
        ) : (
          <ol aria-label="Response rules" className="grid gap-2">
            {responseRules.map((responseRule, ruleIndex) => (
              <ResponseRuleRow
                key={responseRule.id}
                responseRule={responseRule}
                position={ruleIndex + 1}
                isFirst={ruleIndex === 0}
                isLast={ruleIndex === responseRules.length - 1}
                onMove={(step) => {
                  ruleList.moveRule(ruleIndex, step);
                }}
                onToggle={(isEnabled) => {
                  ruleList.toggleRule(responseRule, isEnabled);
                }}
                onEdit={() => {
                  ruleList.openEditor(responseRule);
                }}
                onDelete={() => {
                  ruleList.askToDelete(responseRule);
                }}
              />
            ))}
          </ol>
        )}
        <section
          aria-label="Default reply"
          className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3"
        >
          <span className="text-sm font-medium">Default reply</span>
          <HttpStatusBadge statusCode={httpBin.default_response.status_code} />
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {httpBin.default_response.body === ""
              ? "(empty body)"
              : httpBin.default_response.body}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDefaultReplyOpen(true);
            }}
          >
            <PencilIcon />
            Edit default reply
          </Button>
        </section>
      </div>
      {ruleList.editingRule !== null && (
        <ResponseRuleSheet
          binId={httpBin.id}
          editedRule={ruleList.editingRule.editedRule}
          isSaving={ruleList.isSaving}
          onSave={ruleList.saveEditedRule}
          onClose={ruleList.closeEditor}
        />
      )}
      {isDefaultReplyOpen && (
        <DefaultReplySheet
          httpBin={httpBin}
          onClose={() => {
            setDefaultReplyOpen(false);
          }}
        />
      )}
      <ConfirmDeleteDialog
        itemName={ruleList.deletingRule?.name ?? null}
        consequence="Requests it answered get the next matching rule or the default reply."
        onConfirm={ruleList.deleteRule}
        onClose={() => {
          ruleList.askToDelete(null);
        }}
      />
    </div>
  );
}
