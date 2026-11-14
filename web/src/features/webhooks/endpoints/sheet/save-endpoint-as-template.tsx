import { Link } from "@tanstack/react-router";
import { FileCodeIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { NamePromptDialog } from "@/components/common/name-prompt-dialog";
import { Button } from "@/components/ui/button";
import { useSaveEndpointAsTemplate } from "@/lib/api/hooks/use-webhook-template-queries";
import type { WebhookTemplateSummary } from "@/lib/api/types";

/** Saves the endpoint's template with its overrides as a custom template (WH-09.1). */
export function SaveEndpointAsTemplate({ endpointId }: { endpointId: string }) {
  const saveEndpointAsTemplate = useSaveEndpointAsTemplate();
  const [isNaming, setNaming] = React.useState(false);
  const [savedTemplate, setSavedTemplate] =
    React.useState<WebhookTemplateSummary | null>(null);

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Keep this endpoint's template and overrides, as last saved, as a
          template of your own.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNaming(true);
          }}
        >
          <FileCodeIcon />
          Save as template
        </Button>
      </div>
      {savedTemplate !== null && (
        <p className="text-xs">
          Saved as{" "}
          <Link
            to="/webhooks/templates"
            search={{ template: savedTemplate.id }}
            className="underline underline-offset-4"
          >
            {savedTemplate.name}
          </Link>
          .
        </p>
      )}
      {isNaming && (
        <NamePromptDialog
          title="Save as template"
          description="A custom template with the endpoint's extra headers and body fields written in."
          confirmLabel="Save template"
          initialName=""
          isSubmitting={saveEndpointAsTemplate.isPending}
          onSubmit={(templateName) => {
            saveEndpointAsTemplate.mutate(
              { endpointId, templateName },
              {
                onSuccess: (createdTemplate) => {
                  setNaming(false);
                  setSavedTemplate(createdTemplate);
                  toast("Template saved", {
                    description: createdTemplate.name,
                  });
                },
                onError: () => {
                  toast.error("Could not save the template");
                },
              },
            );
          }}
          onClose={() => {
            setNaming(false);
          }}
        />
      )}
    </div>
  );
}
