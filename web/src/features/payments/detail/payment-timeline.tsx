import type { PaymentDetail } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

const failureKinds = new Set([
  "failed",
  "canceled",
  "expired",
  "dispute_opened",
]);

/** Everything that happened to the payment, oldest first (PY-09.2). */
export function PaymentTimeline({
  paymentDetail,
}: {
  paymentDetail: PaymentDetail;
}) {
  return (
    <section aria-label="Timeline" className="grid gap-2">
      <h3 className="text-sm font-semibold">Timeline</h3>
      <ol className="grid gap-2 border-l pl-4">
        {paymentDetail.timeline.map((timelineEvent, eventIndex) => (
          <li
            key={`${timelineEvent.created_at}-${eventIndex}`}
            className="relative grid gap-0.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-border",
                failureKinds.has(timelineEvent.kind) && "bg-destructive",
                timelineEvent.kind === "succeeded" && "bg-success",
              )}
            />
            <span className="text-sm">{timelineEvent.description}</span>
            <time
              dateTime={timelineEvent.created_at}
              className="text-xs text-muted-foreground"
            >
              {formatDateTime(timelineEvent.created_at)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
