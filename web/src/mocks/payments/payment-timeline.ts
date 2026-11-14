import type { PaymentDetail, PaymentTimelineKind } from "@/lib/api/types";

export function addTimeline(
  paymentDetail: PaymentDetail,
  kind: PaymentTimelineKind,
  description: string,
  createdAt: string,
) {
  paymentDetail.timeline.push({ kind, description, created_at: createdAt });
}
