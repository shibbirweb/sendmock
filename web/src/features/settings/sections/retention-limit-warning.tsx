import { AlertTriangleIcon } from "lucide-react";

/** Shown while a count limit is 0 and no age limit is set (PL-08.4). */
export function RetentionLimitWarning({
  unboundedTraffic,
}: {
  unboundedTraffic: string[];
}) {
  if (unboundedTraffic.length === 0) {
    return null;
  }
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning"
    >
      <AlertTriangleIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
      />
      <span>
        No limit on {unboundedTraffic.join(" and ")}: everything is kept, and
        the database grows until the disk is full. A fixed limit, or an age
        limit, is recommended.
      </span>
    </p>
  );
}
