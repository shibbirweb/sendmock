import * as React from "react";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiError } from "@/lib/api/api-client";
import {
  useInboundRouteTest,
  useSaveInboundRoute,
} from "@/lib/api/hooks/use-inbound-route-queries";
import type {
  InboundRoute,
  InboundRouteAction,
  InboundRouteFilter,
  InboundRouteInput,
} from "@/lib/api/types";
import { findPatternError } from "@/lib/inbound-routes/match-route-filter";
import {
  type InboundRouteFieldErrors,
  validateInboundRoute,
} from "@/lib/inbound-routes/validate-inbound-route";

export const newRouteInput: InboundRouteInput = {
  priority: 10,
  description: "",
  filter: { kind: "match_recipient", pattern: "" },
  actions: [
    { kind: "forward_url", url: "http://localhost:8000/webhooks/mail" },
  ],
};

function toRouteInput(inboundRoute: InboundRoute | null): InboundRouteInput {
  if (inboundRoute === null) {
    return structuredClone(newRouteInput);
  }

  return structuredClone({
    priority: inboundRoute.priority,
    description: inboundRoute.description,
    filter: inboundRoute.filter,
    actions: inboundRoute.actions,
  });
}

/**
 * State, validation, the live match preview and saving for the route sheet
 * (WH-12.7). A pattern error shows as it is typed; the rest on Save.
 */
export function useInboundRouteForm(
  inboundRoute: InboundRoute | null,
  onSaved: () => void,
) {
  const saveRoute = useSaveInboundRoute();
  const [routeInput, setRouteInput] = React.useState(() =>
    toRouteInput(inboundRoute),
  );
  const [hasTriedSave, setTriedSave] = React.useState(false);
  const debouncedFilter = useDebouncedValue(routeInput.filter, 250);
  const isFilterValid =
    debouncedFilter.kind === "catch_all" ||
    findPatternError(debouncedFilter.pattern) === null;
  const testQuery = useInboundRouteTest({
    filter: isFilterValid ? debouncedFilter : { kind: "catch_all" },
  });
  const liveErrors = validateInboundRoute(routeInput);
  const patternError =
    routeInput.filter.kind !== "catch_all" && routeInput.filter.pattern !== ""
      ? findPatternError(routeInput.filter.pattern)
      : null;
  const fieldErrors: InboundRouteFieldErrors = hasTriedSave
    ? liveErrors
    : patternError === null
      ? {}
      : { pattern: patternError };

  return {
    routeInput,
    fieldErrors,
    testResult: isFilterValid ? testQuery.data : undefined,
    isSaving: saveRoute.isPending,
    updateInput: (changedFields: Partial<InboundRouteInput>) => {
      setRouteInput((previousInput) => ({
        ...previousInput,
        ...changedFields,
      }));
    },
    changeFilter: (routeFilter: InboundRouteFilter) => {
      setRouteInput((previousInput) => ({
        ...previousInput,
        filter: routeFilter,
      }));
    },
    changeActions: (routeActions: InboundRouteAction[]) => {
      setRouteInput((previousInput) => ({
        ...previousInput,
        actions: routeActions,
      }));
    },
    save: () => {
      setTriedSave(true);
      if (Object.keys(liveErrors).length > 0) {
        return;
      }
      saveRoute.mutate(
        { routeId: inboundRoute?.id ?? null, routeInput },
        {
          onSuccess: () => {
            toast(inboundRoute === null ? "Route added" : "Route saved");
            onSaved();
          },
          onError: (requestError) => {
            toast.error(
              requestError instanceof ApiError
                ? requestError.message
                : "Could not save the route",
            );
          },
        },
      );
    },
  };
}

export type InboundRouteForm = ReturnType<typeof useInboundRouteForm>;
