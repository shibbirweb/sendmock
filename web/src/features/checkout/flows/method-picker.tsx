import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlowRunner } from "@/features/checkout/flows/flow-runner";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type {
  CheckoutSession,
  PaymentFlowDefinition,
  PaymentMethodDefinition,
} from "@/lib/api/types";

/** The flow a method runs, from the session. */
export function findMethodFlow(
  checkoutSession: CheckoutSession,
  paymentMethod: PaymentMethodDefinition,
): PaymentFlowDefinition | undefined {
  return checkoutSession.flows.find(
    (paymentFlow) => paymentFlow.key === paymentMethod.flow,
  );
}

/** Several methods of one picker tab as tiles; the picked one's flow shows below. */
function MethodGroup({
  checkoutSession,
  groupMethods,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  groupMethods: PaymentMethodDefinition[];
  checkoutActions: CheckoutActions;
}) {
  const [pickedKey, setPickedKey] = React.useState(groupMethods[0]?.key ?? "");
  const pickedMethod = groupMethods.find(
    (paymentMethod) => paymentMethod.key === pickedKey,
  );
  const groupName = React.useId();
  const pickedFlow =
    pickedMethod === undefined
      ? undefined
      : findMethodFlow(checkoutSession, pickedMethod);

  return (
    <div className="grid gap-4">
      {groupMethods.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Methods"
          className="grid grid-cols-3 gap-2"
        >
          {groupMethods.map((paymentMethod) => (
            <label
              key={paymentMethod.key}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border p-3 text-sm has-checked:border-checkout-accent has-checked:ring-2 has-checked:ring-checkout-accent/30"
            >
              <input
                type="radio"
                name={groupName}
                value={paymentMethod.key}
                checked={pickedKey === paymentMethod.key}
                className="sr-only"
                onChange={() => {
                  checkoutActions.showError(null);
                  setPickedKey(paymentMethod.key);
                }}
              />
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: paymentMethod.accent }}
              />
              {paymentMethod.name}
            </label>
          ))}
        </div>
      )}
      {pickedMethod !== undefined && pickedFlow !== undefined && (
        <FlowRunner
          key={pickedMethod.key}
          checkoutSession={checkoutSession}
          paymentMethod={pickedMethod}
          paymentFlow={pickedFlow}
          checkoutActions={checkoutActions}
        />
      )}
    </div>
  );
}

/** A gateway with several methods: one tab per flow picker tab, e.g. Cards, Mobile banking (PY-12.3, PY-12.6). */
export function MethodPicker({
  checkoutSession,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  checkoutActions: CheckoutActions;
}) {
  const methodsByTab = new Map<string, PaymentMethodDefinition[]>();
  checkoutSession.methods.forEach((paymentMethod) => {
    const pickerTab = findMethodFlow(
      checkoutSession,
      paymentMethod,
    )?.picker_tab;
    if (pickerTab !== undefined) {
      methodsByTab.set(pickerTab, [
        ...(methodsByTab.get(pickerTab) ?? []),
        paymentMethod,
      ]);
    }
  });
  const pickerTabs = [...methodsByTab.keys()];

  return (
    <Tabs
      defaultValue={pickerTabs[0]}
      className="gap-4"
      onValueChange={() => {
        checkoutActions.showError(null);
      }}
    >
      <TabsList className="w-full">
        {pickerTabs.map((pickerTab) => (
          <TabsTrigger key={pickerTab} value={pickerTab}>
            {pickerTab}
          </TabsTrigger>
        ))}
      </TabsList>
      {pickerTabs.map((pickerTab) => (
        <TabsContent key={pickerTab} value={pickerTab}>
          <MethodGroup
            checkoutSession={checkoutSession}
            groupMethods={methodsByTab.get(pickerTab) ?? []}
            checkoutActions={checkoutActions}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
