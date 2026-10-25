import { SendIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EndpointGeneralTab } from "@/features/webhooks/endpoints/sheet/endpoint-general-tab";
import { EndpointRetriesTab } from "@/features/webhooks/endpoints/sheet/endpoint-retries-tab";
import { EndpointSecurityTab } from "@/features/webhooks/endpoints/sheet/endpoint-security-tab";
import { EndpointTemplateTab } from "@/features/webhooks/endpoints/sheet/endpoint-template-tab";
import { EndpointVariablesTab } from "@/features/webhooks/endpoints/sheet/endpoint-variables-tab";
import { useWebhookEndpointForm } from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import type { WebhookEndpoint } from "@/lib/api/types";
import type { WebhookEndpointFieldErrors } from "@/lib/webhooks/validate-webhook-endpoint";

type EndpointSheetTab =
  "general" | "template" | "security" | "retries" | "variables";

/** The tab holding each field, so a failed save opens the right one. */
const tabByField: Record<keyof WebhookEndpointFieldErrors, EndpointSheetTab> = {
  name: "general",
  url: "general",
  method: "general",
  timeout_ms: "general",
  is_enabled: "general",
  template_id: "template",
  template_mode: "template",
  headers: "template",
  extra_fields: "template",
  retry_policy: "retries",
  backoff_seconds: "retries",
};

function findFirstErrorTab(
  fieldErrors: WebhookEndpointFieldErrors,
): EndpointSheetTab | undefined {
  const firstErrorField = Object.keys(fieldErrors)[0] as
    keyof WebhookEndpointFieldErrors | undefined;

  return firstErrorField === undefined
    ? undefined
    : tabByField[firstErrorField];
}

function WebhookEndpointForm({
  editedEndpoint,
  initialTemplateId,
  onCreated,
  onDone,
  onSendTest,
}: {
  editedEndpoint: WebhookEndpoint | null;
  initialTemplateId: string;
  onCreated: (createdEndpoint: WebhookEndpoint) => void;
  onDone: () => void;
  onSendTest: (webhookEndpoint: WebhookEndpoint) => void;
}) {
  const [selectedTab, setSelectedTab] =
    React.useState<EndpointSheetTab>("general");
  const { formValues, updateFormValues, fieldErrors, isSaving, saveEndpoint } =
    useWebhookEndpointForm({
      editedEndpoint,
      initialTemplateId,
      onSaved: (savedEndpoint) => {
        if (editedEndpoint === null) {
          onCreated(savedEndpoint);
          return;
        }
        onDone();
      },
    });

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const firstErrorTab = findFirstErrorTab(saveEndpoint());
        if (firstErrorTab !== undefined) {
          setSelectedTab(firstErrorTab);
        }
      }}
    >
      <Tabs
        value={selectedTab}
        onValueChange={(nextTab) => {
          setSelectedTab(nextTab as EndpointSheetTab);
        }}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <div className="overflow-x-auto px-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="template">Template</TabsTrigger>
            <TabsTrigger value="security" disabled={editedEndpoint === null}>
              Security
            </TabsTrigger>
            <TabsTrigger value="retries">Retries</TabsTrigger>
            <TabsTrigger value="variables" disabled={editedEndpoint === null}>
              Variables
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {editedEndpoint === null && (
            <p className="mb-4 text-xs text-muted-foreground">
              The signing secret and variables can be set once the endpoint is
              added.
            </p>
          )}
          <TabsContent value="general">
            <EndpointGeneralTab
              formValues={formValues}
              fieldErrors={fieldErrors}
              onChange={updateFormValues}
            />
          </TabsContent>
          <TabsContent value="template">
            <EndpointTemplateTab
              formValues={formValues}
              onChange={updateFormValues}
            />
          </TabsContent>
          {editedEndpoint !== null && (
            <TabsContent value="security">
              <EndpointSecurityTab
                webhookEndpoint={editedEndpoint}
                templateId={formValues.templateId}
              />
            </TabsContent>
          )}
          <TabsContent value="retries">
            <EndpointRetriesTab
              formValues={formValues}
              fieldErrors={fieldErrors}
              onChange={updateFormValues}
            />
          </TabsContent>
          {editedEndpoint !== null && (
            <TabsContent value="variables">
              <EndpointVariablesTab
                endpointId={editedEndpoint.id}
                templateId={formValues.templateId}
              />
            </TabsContent>
          )}
        </div>
      </Tabs>
      <SheetFooter className="flex-row items-center justify-end border-t">
        {editedEndpoint !== null && (
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            onClick={() => {
              onSendTest(editedEndpoint);
            }}
          >
            <SendIcon />
            Send test
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          {editedEndpoint === null ? "Cancel" : "Close"}
        </Button>
        <Button type="submit" disabled={isSaving}>
          {editedEndpoint === null ? "Add endpoint" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  );
}

/** Side sheet to add or edit a webhook endpoint (WH-01.1). */
export function WebhookEndpointSheet({
  isOpen,
  editedEndpoint,
  initialTemplateId = "native",
  onOpenChange,
  onCreated,
  onSendTest,
}: {
  isOpen: boolean;
  editedEndpoint: WebhookEndpoint | null;
  initialTemplateId?: string;
  onOpenChange: (isOpen: boolean) => void;
  onCreated: (createdEndpoint: WebhookEndpoint) => void;
  onSendTest: (webhookEndpoint: WebhookEndpoint) => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {editedEndpoint === null ? "Add an endpoint" : editedEndpoint.name}
          </SheetTitle>
          <SheetDescription>
            Where SendMock sends webhooks, in which format, and how it retries.
          </SheetDescription>
        </SheetHeader>
        {isOpen && (
          <WebhookEndpointForm
            key={editedEndpoint?.id ?? "new"}
            editedEndpoint={editedEndpoint}
            initialTemplateId={initialTemplateId}
            onCreated={onCreated}
            onDone={() => {
              onOpenChange(false);
            }}
            onSendTest={onSendTest}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
