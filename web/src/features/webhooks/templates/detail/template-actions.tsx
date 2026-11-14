import { Link, useNavigate } from "@tanstack/react-router";
import {
  CopyPlusIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { NamePromptDialog } from "@/components/common/name-prompt-dialog";
import { Button } from "@/components/ui/button";
import {
  useCloneTemplate,
  useDeleteTemplate,
  useExportTemplate,
  useResetTemplate,
} from "@/lib/api/hooks/use-webhook-template-queries";
import type { WebhookTemplateDetail } from "@/lib/api/types";
import { downloadTextFile } from "@/lib/files/download-text-file";

type PendingTemplateDialog = "clone" | "delete" | "reset" | null;

function describeDeleteConsequence(
  templateDetail: WebhookTemplateDetail,
): string {
  const usingCount = templateDetail.used_by_endpoint_count;
  if (usingCount === 0) {
    return "No endpoint uses it. The template and its history are removed.";
  }

  return `${usingCount} endpoint${usingCount === 1 ? " uses" : "s use"} it. They will be detached and keep their own copy, so they go on working.`;
}

/** Edit, Reset to default, Use in new endpoint, Clone, Export and Delete (WH-08.5, WH-09). */
export function TemplateActions({
  templateDetail,
  onEdit,
}: {
  templateDetail: WebhookTemplateDetail;
  onEdit: () => void;
}) {
  const navigate = useNavigate({ from: "/webhooks/templates" });
  const cloneTemplate = useCloneTemplate();
  const deleteTemplate = useDeleteTemplate();
  const exportTemplate = useExportTemplate();
  const resetTemplate = useResetTemplate();
  const [pendingDialog, setPendingDialog] =
    React.useState<PendingTemplateDialog>(null);
  const closeDialog = () => {
    setPendingDialog(null);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" asChild>
        <Link to="/webhooks/endpoints" search={{ template: templateDetail.id }}>
          <PlusIcon />
          Use in new endpoint
        </Link>
      </Button>
      {templateDetail.source !== "file" && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <PencilIcon />
          Edit
        </Button>
      )}
      {templateDetail.is_modified && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPendingDialog("reset");
          }}
        >
          <RotateCcwIcon />
          Reset to default
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setPendingDialog("clone");
        }}
      >
        <CopyPlusIcon />
        Clone
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={exportTemplate.isPending}
        onClick={() => {
          exportTemplate.mutate(templateDetail.id, {
            onSuccess: (templateToml) => {
              downloadTextFile(
                templateToml,
                `${templateDetail.id}.sendmock-template.toml`,
              );
            },
            onError: () => {
              toast.error("Could not export the template");
            },
          });
        }}
      >
        <DownloadIcon />
        Export
      </Button>
      {templateDetail.source === "custom" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPendingDialog("delete");
          }}
        >
          <Trash2Icon />
          Delete
        </Button>
      )}
      {pendingDialog === "clone" && (
        <NamePromptDialog
          title="Clone template"
          description="A custom copy you can change; the original stays as it is."
          confirmLabel="Clone"
          initialName={`${templateDetail.name} (copy)`}
          isSubmitting={cloneTemplate.isPending}
          onSubmit={(cloneName) => {
            cloneTemplate.mutate(
              { templateId: templateDetail.id, cloneName },
              {
                onSuccess: (clonedTemplate) => {
                  closeDialog();
                  toast("Template cloned");
                  void navigate({
                    search: (previousSearch) => ({
                      ...previousSearch,
                      template: clonedTemplate.id,
                    }),
                  });
                },
                onError: () => {
                  toast.error("Could not clone the template");
                },
              },
            );
          }}
          onClose={closeDialog}
        />
      )}
      <ConfirmActionDialog
        isOpen={pendingDialog === "reset"}
        title={`Reset ${templateDetail.name} to default?`}
        consequence="Your edits are dropped and the shipped template comes back for every endpoint that uses it."
        confirmLabel="Reset to default"
        onConfirm={() => {
          resetTemplate.mutate(templateDetail.id, {
            onSuccess: () => {
              toast("Template reset to default");
            },
            onError: () => {
              toast.error("Could not reset the template");
            },
          });
        }}
        onClose={closeDialog}
      />
      <ConfirmActionDialog
        isOpen={pendingDialog === "delete"}
        title={`Delete ${templateDetail.name}?`}
        consequence={describeDeleteConsequence(templateDetail)}
        confirmLabel={
          templateDetail.used_by_endpoint_count > 0
            ? "Detach and delete"
            : "Delete"
        }
        onConfirm={() => {
          deleteTemplate.mutate(
            {
              templateId: templateDetail.id,
              shouldDetach: templateDetail.used_by_endpoint_count > 0,
            },
            {
              onSuccess: () => {
                toast("Template deleted");
                void navigate({
                  search: (previousSearch) => ({
                    ...previousSearch,
                    template: undefined,
                  }),
                });
              },
              onError: () => {
                toast.error("Could not delete the template");
              },
            },
          );
        }}
        onClose={closeDialog}
      />
    </div>
  );
}
