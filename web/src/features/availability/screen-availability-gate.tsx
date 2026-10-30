import { useRouterState } from "@tanstack/react-router";
import type * as React from "react";

import { NotAvailableYetState } from "@/features/availability/not-available-yet-state";
import {
  type ScreenAvailability,
  findScreenForPath,
} from "@/features/availability/screen-availability";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";

function GatedScreen({
  screen,
  children,
}: {
  screen: ScreenAvailability;
  children: React.ReactNode;
}) {
  const availability = useOperationAvailability(screen.listOperationKey);
  // Waiting for /info keeps a screen that is not served from asking for its data.
  if (!availability.isKnown) {
    return null;
  }
  if (availability.isAvailable) {
    return children;
  }

  return (
    <NotAvailableYetState
      featureName={screen.title}
      phase={availability.phase}
      description={screen.upcomingDescription}
      className="flex-1"
    />
  );
}

/**
 * Renders the routed screen, or Not available yet when the running SendMock does
 * not serve the screen's list operation (UI-12.2); the screen's own queries then
 * never run.
 */
export function ScreenAvailabilityGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = useRouterState({
    select: (routerState) => routerState.location.pathname,
  });
  const screen = findScreenForPath(pathname);
  if (screen === undefined) {
    return children;
  }

  return (
    <GatedScreen key={screen.path} screen={screen}>
      {children}
    </GatedScreen>
  );
}
