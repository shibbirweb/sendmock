import type * as React from "react";

import { AccountFlow } from "@/features/checkout/flows/account-flow";
import { BankFlow } from "@/features/checkout/flows/bank-flow";
import { CardFlow } from "@/features/checkout/flows/card-flow";
import type { FlowProps } from "@/features/checkout/flows/flow-props";
import { WalletFlow } from "@/features/checkout/flows/wallet-flow";
import type { PaymentMethodFlow } from "@/lib/api/types";

/** One component and group label per flow; a new flow adds an entry (PY-12.3). */
export const checkoutFlows: Record<
  PaymentMethodFlow,
  { groupLabel: string; render: (flowProps: FlowProps) => React.ReactNode }
> = {
  card: {
    groupLabel: "Cards",
    render: (flowProps) => <CardFlow {...flowProps} />,
  },
  wallet: {
    groupLabel: "Mobile banking",
    render: (flowProps) => <WalletFlow {...flowProps} />,
  },
  bank: {
    groupLabel: "Net banking",
    render: (flowProps) => <BankFlow {...flowProps} />,
  },
  account: {
    groupLabel: "Accounts",
    render: (flowProps) => <AccountFlow {...flowProps} />,
  },
};

export const flowOrder: PaymentMethodFlow[] = [
  "card",
  "wallet",
  "bank",
  "account",
];
