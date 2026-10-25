import * as React from "react";

/** The current time in ms, refreshed every second while `isTicking`. */
export function useCurrentTimeMs(isTicking: boolean): number {
  const [currentTimeMs, setCurrentTimeMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!isTicking) {
      return;
    }

    const tickTimer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(tickTimer);
    };
  }, [isTicking]);

  return currentTimeMs;
}
