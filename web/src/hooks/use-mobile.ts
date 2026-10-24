import * as React from "react";

const mobileBreakpointPx = 768;
const mobileMediaQuery = `(max-width: ${mobileBreakpointPx - 1}px)`;

function subscribeToViewportChanges(onViewportChange: () => void) {
  const mobileQueryList = window.matchMedia(mobileMediaQuery);
  mobileQueryList.addEventListener("change", onViewportChange);

  return () => {
    mobileQueryList.removeEventListener("change", onViewportChange);
  };
}

function readIsMobileViewport(): boolean {
  return window.matchMedia(mobileMediaQuery).matches;
}

/** True when the viewport is narrower than the mobile breakpoint. */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribeToViewportChanges,
    readIsMobileViewport,
    () => false,
  );
}
