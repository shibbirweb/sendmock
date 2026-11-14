import type * as React from "react";

import { NotAvailableYetState } from "@/features/availability/not-available-yet-state";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";

/**
 * A card or section that needs one operation: its content once the running SendMock
 * serves it, Not available yet before (UI-12.2), and nothing while /info loads, so its
 * queries never ask for what is not there.
 */
export function FeatureAvailabilityGate({
  operationKey,
  featureName,
  description,
  children,
}: {
  operationKey: string;
  featureName: string;
  description: string;
  children: React.ReactNode;
}) {
  const availability = useOperationAvailability(operationKey);
  if (!availability.isKnown) {
    return null;
  }
  if (availability.isAvailable) {
    return children;
  }

  return (
    <NotAvailableYetState
      featureName={featureName}
      phase={availability.phase}
      description={description}
      className="rounded-xl border"
    />
  );
}
