import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import { isOperationServed } from "@/lib/api/operation-availability";
import {
  type StageBPhase,
  surfaceCatalogue,
} from "@/lib/api/surface-catalogue";

export type OperationAvailability = {
  /** True when the running SendMock serves the operation, or before /info answers. */
  isAvailable: boolean;
  /** False until /info has answered or failed; queries and screens wait for it. */
  isKnown: boolean;
  phase: StageBPhase;
  /** "Available in Phase 2": the tooltip and accessible name of a disabled control. */
  unavailableLabel: string;
};

/** Whether the running binary serves an operation, and the phase it arrives in (UI-12). */
export function useOperationAvailability(
  operationKey: string,
): OperationAvailability {
  const appInfoQuery = useAppInfo();
  const phase = surfaceCatalogue[operationKey]?.phase ?? "1";

  return {
    isAvailable: isOperationServed(appInfoQuery.data, operationKey, true),
    isKnown: !appInfoQuery.isPending,
    phase,
    unavailableLabel: `Available in Phase ${phase}`,
  };
}

/** For a query's `enabled`: false until /info confirms the server serves the operation. */
export function useIsOperationQueryable(operationKey: string): boolean {
  const appInfoQuery = useAppInfo();

  return (
    !appInfoQuery.isPending &&
    isOperationServed(appInfoQuery.data, operationKey, true)
  );
}
