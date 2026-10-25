import {
  type ApiEndpoint,
  pageOf,
  pageQueryParameters,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const paymentEndpoints = tagEndpoints("Payments", [
  {
    method: "GET",
    path: "/api/v1/payments",
    summary: "Test payments, newest first, with filters.",
    queryParameters: [
      ...pageQueryParameters,
      {
        name: "status",
        description: "succeeded, pending, failed, refunded or disputed.",
        schema: "string",
      },
      { name: "provider", description: "Gateway key.", schema: "string" },
      { name: "currency", description: "ISO 4217 code.", schema: "string" },
    ],
    response: pageOf("PaymentSummary"),
  },
  {
    method: "GET",
    path: "/api/v1/payments/{paymentId}",
    summary:
      "One payment with line items, timeline, redirects and notifications.",
    response: typeRef("PaymentDetail"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/payments/{paymentId}/notify",
    summary: "Send the payment's notification (IPN or webhook) again.",
    response: typeRef("PaymentDetail"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/payments/{paymentId}/simulate",
    summary: "Move the payment on: capture, refund, dispute, fail.",
    requestBody: typeRef("PaymentSimulateRequest"),
    response: typeRef("PaymentDetail"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/payments/checkout",
    summary:
      "Start a hosted checkout on a gateway and get its payment page URL.",
    requestBody: typeRef("PaymentCheckoutCreateRequest"),
    response: typeRef("PaymentDetail"),
    successStatus: 201,
    errorStatuses: [400],
  },
]);

const checkoutEndpoints = tagEndpoints("Checkout", [
  {
    method: "GET",
    path: "/api/v1/checkout-sessions/{sessionId}",
    summary: "What a test checkout page shows: order, methods and flows.",
    response: typeRef("CheckoutSession"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/checkout-sessions/{sessionId}/complete",
    summary: "Pay, decline or cancel from the checkout page.",
    requestBody: typeRef("CheckoutCompleteRequest"),
    response: typeRef("CheckoutSession"),
    errorStatuses: [400, 404, 409],
  },
]);

export const paymentsApi: ApiEndpoint[] = [
  ...paymentEndpoints,
  ...checkoutEndpoints,
];
