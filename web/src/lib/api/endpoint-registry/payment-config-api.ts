import {
  type ApiEndpoint,
  listOf,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const flowEndpoints = tagEndpoints("Payment flows", [
  {
    method: "GET",
    path: "/api/v1/payments/flows",
    summary: "Flows: the steps a checkout page runs for a method.",
    response: listOf("PaymentFlowDefinition"),
  },
  {
    method: "POST",
    path: "/api/v1/payments/flows",
    summary: "Add a flow.",
    requestBody: typeRef("PaymentFlowInput"),
    response: typeRef("PaymentFlowDefinition"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/payments/flows/{flowKey}",
    summary: "Change a flow.",
    requestBody: typeRef("PaymentFlowInput"),
    response: typeRef("PaymentFlowDefinition"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/payments/flows/{flowKey}",
    summary: "Delete a custom flow; 409 while a method uses it.",
    response: null,
    successStatus: 204,
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/payments/flows/{flowKey}/reset",
    summary: "Put a built-in flow back as shipped.",
    response: typeRef("PaymentFlowDefinition"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/payments/flows/{flowKey}/steps",
    summary: "Add a step to a flow.",
    requestBody: typeRef("PaymentFlowStepAddRequest"),
    response: typeRef("PaymentFlowDefinition"),
    errorStatuses: [400, 404],
  },
  {
    method: "PATCH",
    path: "/api/v1/payments/flows/{flowKey}/steps/{stepIndex}",
    summary: "Change one step of a flow.",
    requestBody: typeRef("PaymentFlowStepUpdateRequest"),
    response: typeRef("PaymentFlowDefinition"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/payments/flows/{flowKey}/steps/{stepIndex}",
    summary: "Remove one step of a flow.",
    response: typeRef("PaymentFlowDefinition"),
    errorStatuses: [400, 404],
  },
  {
    method: "GET",
    path: "/api/v1/payments/step-types",
    summary: "The step types a flow can use, with their fields.",
    response: listOf("PaymentStepTypeInfo"),
  },
  {
    method: "GET",
    path: "/api/v1/payments/flow-variables",
    summary: "The variables a step label can use.",
    response: listOf("PaymentFlowVariable"),
  },
]);

const gatewayEndpoints = tagEndpoints("Payment gateways", [
  {
    method: "GET",
    path: "/api/v1/payments/gateways",
    summary: "Gateways with their checkout, redirect and notification setup.",
    response: listOf("PaymentGatewayDefinition"),
  },
  {
    method: "POST",
    path: "/api/v1/payments/gateways",
    summary: "Add a custom gateway.",
    requestBody: typeRef("PaymentGatewayCreateRequest"),
    response: typeRef("PaymentGatewayDefinition"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/payments/gateways/{gatewayKey}",
    summary: "Change a gateway; secret credentials stay masked.",
    requestBody: typeRef("PaymentGatewayInput"),
    response: typeRef("PaymentGatewayDefinition"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/payments/gateways/{gatewayKey}",
    summary: "Delete a custom gateway; 409 while payments use it.",
    response: null,
    successStatus: 204,
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/payments/gateways/{gatewayKey}/reset",
    summary: "Put a built-in gateway back as shipped.",
    response: typeRef("PaymentGatewayDefinition"),
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/payments/gateways/{gatewayKey}/preview",
    summary: "Render a gateway's redirect and notification for a payment.",
    requestBody: typeRef("PaymentGatewayPreviewRequest"),
    response: typeRef("PaymentGatewayPreview"),
  },
  {
    method: "GET",
    path: "/api/v1/payments/gateways/{gatewayKey}/credentials/{credentialName}",
    summary: "Reveal one secret credential (asked for after a confirmation).",
    response: typeRef("GatewayCredentialReveal"),
    errorStatuses: [404],
  },
]);

const methodEndpoints = tagEndpoints("Payment methods", [
  {
    method: "GET",
    path: "/api/v1/payments/methods",
    summary: "Methods customers pay with, and their test values.",
    response: listOf("PaymentMethodDefinition"),
  },
  {
    method: "POST",
    path: "/api/v1/payments/methods",
    summary: "Add a custom method.",
    requestBody: typeRef("PaymentMethodInput"),
    response: typeRef("PaymentMethodDefinition"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/payments/methods/{methodKey}",
    summary: "Change a method.",
    requestBody: typeRef("PaymentMethodInput"),
    response: typeRef("PaymentMethodDefinition"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/payments/methods/{methodKey}",
    summary: "Delete a custom method; 409 while a gateway offers it.",
    response: null,
    successStatus: 204,
    errorStatuses: [404, 409],
  },
  {
    method: "POST",
    path: "/api/v1/payments/methods/{methodKey}/reset",
    summary: "Put a built-in method back as shipped.",
    response: typeRef("PaymentMethodDefinition"),
    errorStatuses: [404, 409],
  },
]);

export const paymentConfigApi: ApiEndpoint[] = [
  ...flowEndpoints,
  ...gatewayEndpoints,
  ...methodEndpoints,
];
