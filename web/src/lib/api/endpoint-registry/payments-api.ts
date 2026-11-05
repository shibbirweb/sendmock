import {
  type ApiEndpoint,
  listOf,
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
        example: "succeeded",
      },
      {
        name: "provider",
        description: "Gateway key.",
        schema: "string",
        example: "stripe",
      },
      {
        name: "currency",
        description: "ISO 4217 code.",
        schema: "string",
        example: "USD",
      },
    ],
    response: pageOf("PaymentSummary"),
  },
  {
    method: "GET",
    path: "/api/v1/payments/test-cards",
    summary: "The test values of every enabled payment method.",
    response: listOf("PaymentMethodDefinition"),
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
    errorStatuses: [400, 404, 409, 422],
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

const subscriptionEndpoints = tagEndpoints("Payments", [
  {
    method: "GET",
    path: "/api/v1/payments/subscriptions",
    summary: "Subscriptions, newest first.",
    response: listOf("PaymentSubscription"),
  },
  {
    method: "POST",
    path: "/api/v1/payments/subscriptions",
    summary: "Start a subscription on a gateway, with an optional trial.",
    requestBody: typeRef("PaymentSubscriptionCreateRequest"),
    response: typeRef("PaymentSubscription"),
    successStatus: 201,
    errorStatuses: [400, 404, 422],
  },
  {
    method: "GET",
    path: "/api/v1/payments/subscriptions/{subscriptionId}",
    summary: "One subscription with its timeline and renewal payments.",
    response: typeRef("PaymentSubscription"),
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/payments/subscriptions/{subscriptionId}/advance",
    summary: "Move the subscription's clock to its next renewal and charge it.",
    response: typeRef("PaymentSubscription"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/payments/subscriptions/{subscriptionId}/cancel",
    summary: "Cancel the subscription now or at the end of its period.",
    requestBody: typeRef("PaymentSubscriptionCancelRequest"),
    response: typeRef("PaymentSubscription"),
    errorStatuses: [404, 409],
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
    errorStatuses: [400, 404, 409, 422],
  },
]);

export const paymentsApi: ApiEndpoint[] = [
  ...paymentEndpoints,
  ...subscriptionEndpoints,
  ...checkoutEndpoints,
];
