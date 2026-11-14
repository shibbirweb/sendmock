import { HistoryIcon, RotateCcwIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  useRestoreTemplateRevision,
  useTemplateRevisions,
} from "@/lib/api/hooks/use-webhook-template-queries";
import type {
  TemplateDraft,
  TemplateRevision,
  WebhookTemplateDetail,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { diffLines } from "@/lib/text/diff-lines";
import { cn } from "@/lib/utils";

/** Headers then body as lines, so one diff covers the whole request shape. */
function toComparableText(templateDraft: TemplateDraft): string {
  const headerLines = Object.entries(templateDraft.header_templates).map(
    ([headerName, headerTemplate]) => `${headerName}: ${headerTemplate}`,
  );

  return [
    `${templateDraft.method} ${templateDraft.content_type}`,
    ...headerLines,
    "",
    templateDraft.body_template,
  ].join("\n");
}

const changeMarks = { same: " ", added: "+", removed: "-" } as const;

function RevisionDiff({
  olderRevision,
  templateDetail,
}: {
  olderRevision: TemplateRevision;
  templateDetail: WebhookTemplateDetail;
}) {
  const changedLines = diffLines(
    toComparableText(olderRevision.template),
    toComparableText(templateDetail),
  );

  return (
    <pre
      aria-label={`Changes from revision ${olderRevision.revision} to the current one`}
      className="max-h-72 overflow-auto rounded-md border bg-muted/30 py-2 font-mono text-xs leading-relaxed"
    >
      {changedLines.map((diffLine, lineIndex) => (
        <div
          key={`${lineIndex}-${diffLine.change}`}
          data-change={diffLine.change}
          className={cn(
            "px-3 whitespace-pre-wrap",
            diffLine.change === "added" && "bg-success/10 text-success",
            diffLine.change === "removed" &&
              "bg-destructive/10 text-destructive",
          )}
        >
          {changeMarks[diffLine.change]} {diffLine.lineText}
        </div>
      ))}
    </pre>
  );
}

/** The last 20 revisions, each diffed against the current one and restorable (WH-09.5). */
export function TemplateHistory({
  templateDetail,
}: {
  templateDetail: WebhookTemplateDetail;
}) {
  const revisionsQuery = useTemplateRevisions(templateDetail.id);
  const restoreRevision = useRestoreTemplateRevision();
  const [comparedRevision, setComparedRevision] = React.useState<number | null>(
    null,
  );
  const [revisionToRestore, setRevisionToRestore] = React.useState<
    number | null
  >(null);
  const templateRevisions = revisionsQuery.data ?? [];

  if (templateRevisions.length === 0) {
    return null;
  }

  return (
    <section aria-label="History" className="grid gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <HistoryIcon aria-hidden="true" className="size-4" />
        History
      </h3>
      <ol className="grid gap-2">
        {templateRevisions.map((templateRevision) => {
          const isCurrent =
            templateRevision.revision === templateDetail.revision;
          const isCompared = comparedRevision === templateRevision.revision;

          return (
            <li
              key={templateRevision.revision}
              data-testid="template-revision"
              className="grid gap-2"
            >
              <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">
                  Revision {templateRevision.revision}
                </span>
                {isCurrent && (
                  <span className="text-xs text-muted-foreground">current</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(templateRevision.saved_at)}
                </span>
                {!isCurrent && (
                  <span className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={isCompared}
                      onClick={() => {
                        setComparedRevision(
                          isCompared ? null : templateRevision.revision,
                        );
                      }}
                    >
                      {isCompared ? "Hide changes" : "Compare"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRevisionToRestore(templateRevision.revision);
                      }}
                    >
                      <RotateCcwIcon />
                      Restore
                    </Button>
                  </span>
                )}
              </div>
              {isCompared && (
                <RevisionDiff
                  olderRevision={templateRevision}
                  templateDetail={templateDetail}
                />
              )}
            </li>
          );
        })}
      </ol>
      <ConfirmActionDialog
        isOpen={revisionToRestore !== null}
        title={`Restore revision ${revisionToRestore ?? ""}?`}
        consequence="It is saved again as a new revision, so the current one stays in the history."
        confirmLabel="Restore"
        onConfirm={() => {
          if (revisionToRestore === null) {
            return;
          }
          restoreRevision.mutate(
            { templateId: templateDetail.id, revision: revisionToRestore },
            {
              onSuccess: (restoredTemplate) => {
                setComparedRevision(null);
                toast(`Restored as revision ${restoredTemplate.revision}`);
              },
              onError: () => {
                toast.error("Could not restore the revision");
              },
            },
          );
        }}
        onClose={() => {
          setRevisionToRestore(null);
        }}
      />
    </section>
  );
}
