import { useNavigate, useSearch } from "@tanstack/react-router";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { templateSourceLabels } from "@/features/webhooks/templates/template-card";
import { TemplateActions } from "@/features/webhooks/templates/detail/template-actions";
import { TemplateFacts } from "@/features/webhooks/templates/detail/template-facts";
import { TemplatePreview } from "@/features/webhooks/templates/detail/template-preview";
import { useTemplatePreview } from "@/features/webhooks/templates/detail/use-template-preview";
import { TemplateEditForm } from "@/features/webhooks/templates/edit/template-edit-form";
import { useWebhookTemplate } from "@/lib/api/hooks/use-webhook-template-queries";
import type { WebhookTemplateDetail } from "@/lib/api/types";

function TemplateDrawerContent({ templateId }: { templateId: string }) {
  const templateQuery = useWebhookTemplate(templateId);

  if (templateQuery.isPending) {
    return (
      <div className="grid gap-3 px-4">
        <SheetTitle className="sr-only">Template</SheetTitle>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (templateQuery.isError) {
    return (
      <div className="px-4">
        <SheetTitle className="sr-only">Template</SheetTitle>
        <p className="text-sm text-destructive">
          This template no longer exists.
        </p>
      </div>
    );
  }

  return <TemplateDetailBody templateDetail={templateQuery.data} />;
}

function TemplateDetailBody({
  templateDetail,
}: {
  templateDetail: WebhookTemplateDetail;
}) {
  const [isEditing, setEditing] = React.useState(false);
  const templatePreview = useTemplatePreview(templateDetail);

  return (
    <div className="grid min-w-0 gap-5 px-4 pb-6">
      <SheetHeader className="p-0">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {templateDetail.name}
          {templateDetail.is_modified && (
            <Badge variant="outline">Modified</Badge>
          )}
        </SheetTitle>
        <SheetDescription>
          {templateDetail.service} ·{" "}
          {templateSourceLabels[templateDetail.source]} · revision{" "}
          {templateDetail.revision}
        </SheetDescription>
      </SheetHeader>
      {isEditing ? (
        <TemplateEditForm
          templateDetail={templateDetail}
          onDone={() => {
            setEditing(false);
          }}
        />
      ) : (
        <>
          <TemplateActions
            templateDetail={templateDetail}
            onEdit={() => {
              setEditing(true);
            }}
          />
          <TemplateFacts templateDetail={templateDetail} />
          <Separator />
          <TemplatePreview
            templatePreview={templatePreview}
            contentType={templateDetail.content_type}
          />
        </>
      )}
    </div>
  );
}

/** One template's detail and preview, open while `?template=` is set (WH-08.4). */
export function TemplateDrawer() {
  const { template: openTemplateId } = useSearch({
    from: "/webhooks/templates",
  });
  const navigate = useNavigate({ from: "/webhooks/templates" });

  return (
    <Sheet
      open={openTemplateId !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          void navigate({
            search: (previousSearch) => ({
              ...previousSearch,
              template: undefined,
            }),
          });
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto pt-4 data-[side=right]:sm:max-w-2xl">
        {openTemplateId !== undefined && (
          <TemplateDrawerContent templateId={openTemplateId} />
        )}
      </SheetContent>
    </Sheet>
  );
}
