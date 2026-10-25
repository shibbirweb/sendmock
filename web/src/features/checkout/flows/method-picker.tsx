import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  checkoutFlows,
  flowOrder,
} from "@/features/checkout/flows/flow-registry";
import type { CheckoutActions } from "@/features/checkout/use-checkout-actions";
import type { CheckoutSession, PaymentMethodDefinition } from "@/lib/api/types";

/** Several methods of one flow as tiles; the picked one's flow shows below. */
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
      {pickedMethod !== undefined && (
        <React.Fragment key={pickedMethod.key}>
          {checkoutFlows[pickedMethod.flow].render({
            checkoutSession,
            paymentMethod: pickedMethod,
            checkoutActions,
          })}
        </React.Fragment>
      )}
    </div>
  );
}

/** A gateway with several methods: one tab per flow, e.g. Cards, Mobile banking (PY-12.3). */
export function MethodPicker({
  checkoutSession,
  checkoutActions,
}: {
  checkoutSession: CheckoutSession;
  checkoutActions: CheckoutActions;
}) {
  const presentFlows = flowOrder.filter((methodFlow) =>
    checkoutSession.methods.some(
      (paymentMethod) => paymentMethod.flow === methodFlow,
    ),
  );

  return (
    <Tabs
      defaultValue={presentFlows[0]}
      className="gap-4"
      onValueChange={() => {
        checkoutActions.showError(null);
      }}
    >
      <TabsList className="w-full">
        {presentFlows.map((methodFlow) => (
          <TabsTrigger key={methodFlow} value={methodFlow}>
            {checkoutFlows[methodFlow].groupLabel}
          </TabsTrigger>
        ))}
      </TabsList>
      {presentFlows.map((methodFlow) => (
        <TabsContent key={methodFlow} value={methodFlow}>
          <MethodGroup
            checkoutSession={checkoutSession}
            groupMethods={checkoutSession.methods.filter(
              (paymentMethod) => paymentMethod.flow === methodFlow,
            )}
            checkoutActions={checkoutActions}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
