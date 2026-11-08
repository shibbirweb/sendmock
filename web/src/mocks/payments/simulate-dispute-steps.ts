import type {
  PaymentDetail,
  PaymentEventType,
  PaymentSimulateRequest,
} from "@/lib/api/types";
import { addTimeline } from "@/mocks/payments/payment-timeline";

/** A dispute's Simulate step; it needs nothing from the database. */
type DisputeStep = (
  mockDatabase: unknown,
  paymentDetail: PaymentDetail,
  simulateRequest: PaymentSimulateRequest,
  createdAt: string,
) => PaymentEventType[];

export const openDisputeStep: DisputeStep = (
  _mockDatabase,
  paymentDetail,
  _simulateRequest,
  createdAt,
) => {
  paymentDetail.status = "disputed";
  paymentDetail.dispute = {
    status: "needs_response",
    reason: "fraudulent",
    evidence: null,
  };
  addTimeline(
    paymentDetail,
    "dispute_opened",
    "Dispute opened: fraudulent",
    createdAt,
  );
  return ["payment.dispute_opened"];
};

/** The merchant's evidence puts the dispute under review (PY-07.3). */
export const answerDisputeStep: DisputeStep = (
  _mockDatabase,
  paymentDetail,
  simulateRequest,
  createdAt,
) => {
  const disputeEvidence =
    simulateRequest.dispute_evidence?.trim() || "Evidence sent";
  paymentDetail.dispute = {
    status: "under_review",
    reason: paymentDetail.dispute?.reason ?? "fraudulent",
    evidence: disputeEvidence,
  };
  addTimeline(
    paymentDetail,
    "dispute_answered",
    "Dispute answered with evidence",
    createdAt,
  );
  return ["payment.dispute_updated"];
};

export const resolveDisputeStep: DisputeStep = (
  _mockDatabase,
  paymentDetail,
  simulateRequest,
  createdAt,
) => {
  const isWon = simulateRequest.dispute_outcome !== "lost";
  paymentDetail.dispute = {
    status: isWon ? "won" : "lost",
    reason: paymentDetail.dispute?.reason ?? "fraudulent",
    evidence: paymentDetail.dispute?.evidence ?? null,
  };
  if (isWon) {
    paymentDetail.status =
      paymentDetail.refunded_minor > 0 ? "partially_refunded" : "succeeded";
  } else {
    // A lost dispute returns the money to the customer.
    paymentDetail.refunded_minor = paymentDetail.captured_minor;
    paymentDetail.status = "refunded";
  }
  addTimeline(
    paymentDetail,
    "dispute_closed",
    `Dispute ${isWon ? "won" : "lost"}`,
    createdAt,
  );
  return ["payment.dispute_closed"];
};
