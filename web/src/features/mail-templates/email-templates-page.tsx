import { PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OperationButton } from "@/features/availability/operation-button";
import { EmailTemplateSheet } from "@/features/mail-templates/email-template-sheet";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  useDeleteEmailTemplate,
  useEmailTemplates,
} from "@/lib/api/hooks/use-email-template-queries";
import type { EmailTemplate } from "@/lib/api/types";

function describeBodies(emailTemplate: EmailTemplate): string {
  return [
    emailTemplate.text !== null && "Text",
    emailTemplate.html !== null && "HTML",
  ]
    .filter(Boolean)
    .join(" and ");
}

function EmailTemplatesTable({
  emailTemplates,
  onEdit,
}: {
  emailTemplates: EmailTemplate[];
  onEdit: (emailTemplate: EmailTemplate) => void;
}) {
  return (
    <Table aria-label="Email templates">
      <TableHeader>
        <TableRow>
          <TableHead>Template</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Bodies</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {emailTemplates.map((emailTemplate) => (
          <TableRow
            key={emailTemplate.id}
            className="cursor-pointer"
            onClick={() => onEdit(emailTemplate)}
          >
            <TableCell className="font-mono text-xs">
              <button
                type="button"
                className="underline-offset-4 hover:underline"
              >
                {emailTemplate.id}
              </button>
            </TableCell>
            <TableCell>{emailTemplate.subject}</TableCell>
            <TableCell className="text-muted-foreground">
              {describeBodies(emailTemplate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Mail > Templates: local stand-ins for providers' email templates (EM-26.2). */
export function EmailTemplatesPage() {
  usePageTitle("Templates", "Mail");
  const templatesQuery = useEmailTemplates();
  const deleteTemplate = useDeleteEmailTemplate();
  const [sheetTemplate, setSheetTemplate] =
    React.useState<EmailTemplate | null>(null);
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] =
    React.useState<EmailTemplate | null>(null);
  const emailTemplates = templatesQuery.data ?? [];

  const openSheet = (emailTemplate: EmailTemplate | null) => {
    setSheetTemplate(emailTemplate);
    setSheetOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Email templates</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Local stand-ins for your provider&apos;s templates. A SendGrid,
              Postmark or Mailgun send that names one gets its subject and
              bodies, rendered from the send&apos;s template data, and
              Mailgun&apos;s template API answers from them.
            </p>
          </div>
          <OperationButton
            operationKey="POST /api/v1/emails/templates"
            actionName="New template"
            size="sm"
            onClick={() => openSheet(null)}
          >
            <PlusIcon />
            New template
          </OperationButton>
        </header>
        <div className="min-w-0 rounded-lg border">
          {templatesQuery.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : templatesQuery.isError ? (
            <QueryErrorState
              message="Could not load the email templates."
              onRetry={() => void templatesQuery.refetch()}
            />
          ) : emailTemplates.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No template yet. Add one under the id your app sends.
            </p>
          ) : (
            <EmailTemplatesTable
              emailTemplates={emailTemplates}
              onEdit={openSheet}
            />
          )}
        </div>
      </div>
      <EmailTemplateSheet
        isOpen={isSheetOpen}
        editedTemplate={sheetTemplate}
        onClose={() => setSheetOpen(false)}
        onDelete={(emailTemplate) => {
          setSheetOpen(false);
          setPendingDelete(emailTemplate);
        }}
      />
      <ConfirmDeleteDialog
        itemName={pendingDelete?.id ?? null}
        consequence="Sends that name it keep the bodies they were sent with."
        onConfirm={() => {
          if (pendingDelete === null) {
            return;
          }
          const deletedId = pendingDelete.id;
          deleteTemplate.mutate(deletedId, {
            onSuccess: () => toast(`${deletedId} deleted`),
          });
          setPendingDelete(null);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
