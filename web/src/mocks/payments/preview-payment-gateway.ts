import type {
  GatewayTemplateProblem,
  PaymentDetail,
  PaymentGatewayInput,
  PaymentGatewayPreview,
  PaymentGatewayPreviewRequest,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { gatewayFieldDescriptions } from "@/mocks/payments/gateway-field-descriptions";
import {
  findGatewayRecord,
  mergeCredentials,
} from "@/mocks/payments/payment-gateway-record";
import {
  buildGatewayContext,
  type GatewayRenderOptions,
  renderGatewayNotification,
  renderGatewayRedirect,
} from "@/mocks/payments/render-gateway-templates";
import { buildContextReference } from "@/mocks/webhooks/build-template-reference";
import { renderTemplateText } from "@/mocks/webhooks/render-template-text";

type PreviewDatabase = Pick<MockDatabase, "paymentGateways" | "payments">;

/** The chosen payment, else the gateway's newest, else the newest of any gateway. */
function findPreviewPayment(
  mockDatabase: PreviewDatabase,
  gatewayKey: string,
  paymentId: string | undefined,
): PaymentDetail | undefined {
  return (
    mockDatabase.payments.find((payment) => payment.id === paymentId) ??
    mockDatabase.payments.find((payment) => payment.provider === gatewayKey) ??
    mockDatabase.payments[0]
  );
}

/**
 * Renders an unsaved gateway's redirect and notification against a payment,
 * with secrets masked and every template problem named by its part (PY-12.4).
 */
export function previewPaymentGateway(
  mockDatabase: PreviewDatabase,
  gatewayInput: PaymentGatewayInput,
  previewRequest: Omit<PaymentGatewayPreviewRequest, "gateway">,
  nowMs: number = Date.now(),
): PaymentGatewayPreview {
  const storedGateway = findGatewayRecord(mockDatabase, gatewayInput.key);
  const renderedGateway: PaymentGatewayInput = {
    ...gatewayInput,
    credentials: mergeCredentials(
      storedGateway?.credentials ?? [],
      gatewayInput.credentials,
    ),
  };
  const previewPayment = findPreviewPayment(
    mockDatabase,
    gatewayInput.key,
    previewRequest.payment_id,
  );
  const renderOptions: GatewayRenderOptions = {
    eventType: previewRequest.event_type,
    redirectOutcome: previewRequest.redirect_outcome,
    eventId: "evt_01JB7T9Q2RPREVIEW0000000",
    timestampSeconds: Math.floor(nowMs / 1000),
    shouldMaskSecrets: true,
  };
  if (previewPayment === undefined) {
    return {
      payment_id: null,
      redirect: { method: gatewayInput.redirect_method, url: "", fields: {} },
      notification: null,
      problems: [],
      reference: buildContextReference({}, gatewayFieldDescriptions),
    };
  }
  const renderedRedirect = renderGatewayRedirect(
    renderedGateway,
    previewPayment,
    renderOptions,
  );
  const renderedNotification = renderGatewayNotification(
    renderedGateway,
    previewPayment,
    renderOptions,
  );
  const redirectUrls = {
    success: previewPayment.success_url,
    fail: previewPayment.fail_url,
    cancel: previewPayment.cancel_url,
  };

  return {
    payment_id: previewPayment.id,
    redirect: {
      method: renderedRedirect.method,
      url:
        redirectUrls[previewRequest.redirect_outcome] ??
        `http://localhost:8000/checkout/${previewRequest.redirect_outcome}`,
      fields: renderedRedirect.fields,
    },
    notification:
      renderedNotification === null
        ? null
        : {
            event_name: renderedNotification.eventName,
            headers: renderedNotification.headers,
            body: renderedNotification.body,
          },
    problems: [
      ...renderedRedirect.problems,
      ...(renderedNotification?.problems ?? []),
    ],
    reference: buildContextReference(
      buildGatewayContext(renderedGateway, previewPayment, renderOptions),
      gatewayFieldDescriptions,
    ),
  };
}

/**
 * Template errors that refuse a save (unknown functions or filters,
 * unbalanced braces), found without a payment so every template is checked.
 */
export function findGatewayTemplateErrors(
  gatewayInput: PaymentGatewayInput,
): GatewayTemplateProblem[] {
  const templateParts = [
    ...gatewayInput.redirect_fields.map((redirectField) => ({
      part: `Redirect field ${redirectField.name}`,
      template: redirectField.template,
    })),
    ...gatewayInput.notification_headers.map((headerTemplate) => ({
      part: `Header ${headerTemplate.name}`,
      template: headerTemplate.template,
    })),
    { part: "Notification body", template: gatewayInput.notification_body },
  ];

  return templateParts.flatMap(({ part, template }) =>
    renderTemplateText(template, {}).errors.map((message) => ({
      part,
      message,
      severity: "error" as const,
    })),
  );
}
