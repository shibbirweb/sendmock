import * as React from "react";

import { Badge } from "@/components/ui/badge";
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
import { ProviderCallbacksTab } from "@/features/providers/provider-callbacks-tab";
import { ProviderGeneralTab } from "@/features/providers/provider-general-tab";
import { ProviderMappingEditor } from "@/features/providers/provider-mapping-editor";
import { ProviderOperationsEditor } from "@/features/providers/provider-operations-editor";
import { ProviderPreviewTab } from "@/features/providers/provider-preview-tab";
import { ProviderResponsesTab } from "@/features/providers/provider-responses-tab";
import { ProviderTryItTab } from "@/features/providers/provider-try-it-tab";
import { useMessageProviderForm } from "@/features/providers/use-message-provider-form";
import type {
  MessageProviderArea,
  MessageProviderDefinition,
} from "@/lib/api/types";

type ProviderTab =
  "general" | "requests" | "responses" | "callbacks" | "preview" | "try-it";

const providerTabs: { tab: ProviderTab; label: string }[] = [
  { tab: "general", label: "General" },
  { tab: "requests", label: "Requests" },
  { tab: "responses", label: "Responses" },
  { tab: "callbacks", label: "Callbacks" },
  { tab: "preview", label: "Preview" },
  { tab: "try-it", label: "Try it" },
];

/** Edit a provider in tabs with a live preview (EM-18.2, EM-18.4, SM-16.2, SM-16.4). Mount when opening. */
export function MessageProviderSheet({
  providerArea,
  messageProvider,
  areaProviders,
  onClose,
}: {
  providerArea: MessageProviderArea;
  messageProvider: MessageProviderDefinition;
  areaProviders: MessageProviderDefinition[];
  onClose: () => void;
}) {
  const providerForm = useMessageProviderForm(
    providerArea,
    messageProvider,
    areaProviders,
    onClose,
  );
  const [openTab, setOpenTab] = React.useState<ProviderTab>("general");
  const templateErrorCount = providerForm.templateErrors.length;

  return (
    <Sheet open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>{messageProvider.name}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {messageProvider.is_builtin ? "Built-in" : "Custom"}
            </Badge>
            {messageProvider.is_modified && (
              <Badge variant="secondary">Modified</Badge>
            )}
            <span>
              Key <code className="font-mono">{messageProvider.key}</code>,{" "}
              {messageProvider.message_count_24h} messages in the last 24 hours.
            </span>
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            providerForm.save();
          }}
        >
          <Tabs
            value={openTab}
            onValueChange={(nextTab) => setOpenTab(nextTab as ProviderTab)}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <div className="overflow-x-auto px-4">
              <TabsList>
                {providerTabs.map(({ tab, label }) => (
                  <TabsTrigger key={tab} value={tab}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <TabsContent value="general" className="max-w-2xl">
                <ProviderGeneralTab
                  providerForm={providerForm}
                  savedCredentials={messageProvider.credentials}
                />
              </TabsContent>
              <TabsContent value="requests" className="grid max-w-3xl gap-5">
                <ProviderOperationsEditor providerForm={providerForm} />
                <ProviderMappingEditor providerForm={providerForm} />
              </TabsContent>
              <TabsContent value="responses" className="max-w-3xl">
                <ProviderResponsesTab providerForm={providerForm} />
              </TabsContent>
              <TabsContent value="callbacks" className="max-w-3xl">
                <ProviderCallbacksTab providerForm={providerForm} />
              </TabsContent>
              <TabsContent value="preview">
                <ProviderPreviewTab providerForm={providerForm} />
              </TabsContent>
              <TabsContent value="try-it">
                <ProviderTryItTab providerForm={providerForm} />
              </TabsContent>
            </div>
          </Tabs>
          <SheetFooter className="flex-row items-center justify-end gap-2 border-t">
            {templateErrorCount > 0 && (
              <p className="me-auto text-xs text-destructive">
                {templateErrorCount} template{" "}
                {templateErrorCount === 1 ? "error" : "errors"}: see Preview
              </p>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                providerForm.isSaving ||
                !providerForm.isDirty ||
                templateErrorCount > 0
              }
            >
              Save provider
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
