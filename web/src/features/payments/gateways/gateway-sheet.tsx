import * as React from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GatewayCheckoutTab } from "@/features/payments/gateways/gateway-checkout-tab";
import { GatewayGeneralTab } from "@/features/payments/gateways/gateway-general-tab";
import { GatewayMerchantTab } from "@/features/payments/gateways/gateway-merchant-tab";
import { GatewayNotificationTab } from "@/features/payments/gateways/gateway-notification-tab";
import { GatewayPreviewPanel } from "@/features/payments/gateways/gateway-preview-panel";
import { GatewayRedirectTab } from "@/features/payments/gateways/gateway-redirect-tab";
import { GatewaySheetFooter } from "@/features/payments/gateways/gateway-sheet-footer";
import { usePaymentGatewayForm } from "@/features/payments/gateways/use-payment-gateway-form";
import type { CodeEditorHandle } from "@/features/webhooks/templates/reference/code-editor/code-editor-types";
import { TemplateReferencePanel } from "@/features/webhooks/templates/reference/template-reference-panel";
import type { PaymentGatewayDefinition } from "@/lib/api/types";

type GatewayTab =
  "general" | "checkout" | "merchant" | "redirect" | "notification";

const gatewayTabs: { tab: GatewayTab; label: string }[] = [
  { tab: "general", label: "General" },
  { tab: "checkout", label: "Checkout" },
  { tab: "merchant", label: "Merchant" },
  { tab: "redirect", label: "Redirect" },
  { tab: "notification", label: "Notification" },
];

/** The live preview and the template reference, beside Redirect and Notification (PY-12.4). */
function TemplateSidePanel({
  gatewayForm,
  onInsert,
}: {
  gatewayForm: ReturnType<typeof usePaymentGatewayForm>;
  onInsert: (insertText: string) => void;
}) {
  return (
    <Tabs defaultValue="preview" className="min-w-0 gap-3">
      <TabsList>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="reference">Reference</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <GatewayPreviewPanel gatewayForm={gatewayForm} />
      </TabsContent>
      <TabsContent value="reference">
        <TemplateReferencePanel
          templateReference={gatewayForm.previewQuery.data?.reference}
          onInsert={onInsert}
        />
      </TabsContent>
    </Tabs>
  );
}

/** Edit a gateway in tabs with a live preview (PY-12.2, PY-12.4). Mount when opening. */
export function GatewaySheet({
  paymentGateway,
  onClose,
}: {
  paymentGateway: PaymentGatewayDefinition;
  onClose: () => void;
}) {
  const gatewayForm = usePaymentGatewayForm(paymentGateway, onClose);
  const bodyEditorRef = React.useRef<CodeEditorHandle | null>(null);
  const [openTab, setOpenTab] = React.useState<GatewayTab>("general");
  const hasSidePanel = openTab === "redirect" || openTab === "notification";

  return (
    <Sheet open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-6xl">
        <SheetHeader>
          <SheetTitle>{paymentGateway.name}</SheetTitle>
          <SheetDescription>
            {paymentGateway.is_builtin ? "Built-in" : "Custom"} gateway, key{" "}
            <code className="font-mono">{paymentGateway.key}</code>.{" "}
            {paymentGateway.payment_count} payments.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            gatewayForm.save();
          }}
        >
          <Tabs
            value={openTab}
            onValueChange={(nextTab) => setOpenTab(nextTab as GatewayTab)}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <div className="overflow-x-auto px-4">
              <TabsList>
                {gatewayTabs.map(({ tab, label }) => (
                  <TabsTrigger key={tab} value={tab}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div
              className={
                hasSidePanel
                  ? "grid min-h-0 flex-1 items-start gap-6 overflow-y-auto px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                  : "grid min-h-0 max-w-2xl flex-1 content-start overflow-y-auto px-4 pb-4"
              }
            >
              <div className="min-w-0">
                <TabsContent value="general">
                  <GatewayGeneralTab gatewayForm={gatewayForm} />
                </TabsContent>
                <TabsContent value="checkout">
                  <GatewayCheckoutTab gatewayForm={gatewayForm} />
                </TabsContent>
                <TabsContent value="merchant">
                  <GatewayMerchantTab
                    gatewayForm={gatewayForm}
                    savedCredentials={paymentGateway.credentials}
                  />
                </TabsContent>
                <TabsContent value="redirect">
                  <GatewayRedirectTab gatewayForm={gatewayForm} />
                </TabsContent>
                <TabsContent value="notification">
                  <GatewayNotificationTab
                    gatewayForm={gatewayForm}
                    bodyEditorRef={bodyEditorRef}
                  />
                </TabsContent>
              </div>
              {hasSidePanel && (
                <TemplateSidePanel
                  gatewayForm={gatewayForm}
                  onInsert={(insertText) => {
                    if (
                      openTab === "notification" &&
                      bodyEditorRef.current !== null
                    ) {
                      bodyEditorRef.current.insertText(insertText);
                      return;
                    }
                    void navigator.clipboard?.writeText(insertText);
                    toast(`Copied ${insertText}`);
                  }}
                />
              )}
            </div>
          </Tabs>
          <GatewaySheetFooter
            paymentGateway={paymentGateway}
            gatewayForm={gatewayForm}
            onClose={onClose}
          />
        </form>
      </SheetContent>
    </Sheet>
  );
}
