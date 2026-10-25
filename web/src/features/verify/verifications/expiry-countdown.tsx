import * as React from "react";

import { formatExpiryCountdown } from "@/features/verify/verifications/format-expiry-countdown";
import { formatDateTime } from "@/lib/format/format-values";

/**
 * "Expires in 9:41" for a pending code, then "Expired" once it runs out;
 * `onExpired` fires once at that moment so the list can refresh.
 */
export function ExpiryCountdown({
  expiresAt,
  currentTimeMs,
  onExpired,
}: {
  expiresAt: string;
  currentTimeMs: number;
  onExpired?: () => void;
}) {
  const countdownText = formatExpiryCountdown(expiresAt, currentTimeMs);
  const hasExpired = countdownText === null;

  React.useEffect(() => {
    if (hasExpired) {
      onExpired?.();
    }
  }, [hasExpired, onExpired]);

  return (
    <time
      dateTime={expiresAt}
      title={`Expires ${formatDateTime(expiresAt)}`}
      className="whitespace-nowrap tabular-nums"
    >
      {hasExpired ? "Expired" : `Expires in ${countdownText}`}
    </time>
  );
}
