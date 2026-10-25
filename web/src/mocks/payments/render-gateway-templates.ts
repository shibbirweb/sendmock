import type {
  GatewayTemplateProblem,
  PaymentDetail,
  PaymentEventType,
  PaymentGatewayInput,
  PaymentRedirect,
} from "@/lib/api/types";
import {
  renderTemplateText,
  type TemplateContext,
} from "@/mocks/webhooks/render-template-text";

type RedirectOutcome = PaymentRedirect["outcome"];

/** Which native event a redirect outcome stands for, for `redirect.status`. */
const redirectOutcomeEvents: Record<RedirectOutcome, PaymentEventType> = {
  success: "payment.succeeded",
  fail: "payment.failed",
  cancel: "payment.canceled",
};

/** "12.00" from 1200 minor units; currencies without decimals stay whole. */
export function toMajorAmountText(paymentDetail: PaymentDetail): string {
  return paymentDetail.currency === "JPY"
    ? String(paymentDetail.amount_minor)
    : (paymentDetail.amount_minor / 100).toFixed(2);
}

/** A secret shown in previews: `••••` and its last 4. */
export function maskSecretValue(secretValue: string): string {
  return `••••${secretValue.slice(-4)}`;
}

export type GatewayRenderOptions = {
  eventType: PaymentEventType;
  redirectOutcome: RedirectOutcome;
  eventId: string;
  timestampSeconds: number;
  /** Previews mask secret credentials; real deliveries use them. */
  shouldMaskSecrets: boolean;
};

/**
 * What a gateway's templates read (17-payments): `payment`, `event`,
 * `redirect` and `merchant`.
 */
export function buildGatewayContext(
  paymentGateway: Pick<PaymentGatewayInput, "credentials" | "event_names">,
  paymentDetail: PaymentDetail,
  renderOptions: GatewayRenderOptions,
): TemplateContext {
  return {
    payment: {
      id: paymentDetail.id,
      reference: paymentDetail.provider_reference,
      amount_minor: paymentDetail.amount_minor,
      amount_major: toMajorAmountText(paymentDetail),
      currency: paymentDetail.currency,
      status: paymentDetail.status,
      failure_code: paymentDetail.failure_code,
      customer: {
        email: paymentDetail.customer_email,
        name: paymentDetail.customer_name,
        phone: paymentDetail.customer_phone,
      },
      method: paymentDetail.method,
      provider_ids: paymentDetail.provider_ids,
      metadata: paymentDetail.metadata,
    },
    event: {
      id: renderOptions.eventId,
      type: renderOptions.eventType,
      name: paymentGateway.event_names[renderOptions.eventType] ?? "",
      created: renderOptions.timestampSeconds,
    },
    redirect: {
      outcome: renderOptions.redirectOutcome,
      status:
        paymentGateway.event_names[
          redirectOutcomeEvents[renderOptions.redirectOutcome]
        ] ?? "",
    },
    merchant: Object.fromEntries(
      paymentGateway.credentials.map((credential) => [
        credential.name,
        renderOptions.shouldMaskSecrets && credential.is_secret
          ? maskSecretValue(credential.value)
          : credential.value,
      ]),
    ),
  };
}

function renderPart(
  templateText: string,
  templateContext: TemplateContext,
  partName: string,
  problems: GatewayTemplateProblem[],
): string {
  const renderOutcome = renderTemplateText(templateText, templateContext);
  renderOutcome.errors.forEach((message) => {
    problems.push({ part: partName, message, severity: "error" });
  });
  renderOutcome.warnings.forEach((message) => {
    problems.push({ part: partName, message, severity: "warning" });
  });

  return renderOutcome.renderedText;
}

export type RenderedRedirect = {
  method: "GET" | "POST";
  fields: Record<string, string>;
  problems: GatewayTemplateProblem[];
};

/** A gateway's redirect fields for one outcome; success-only fields are left out otherwise (PY-12.3). */
export function renderGatewayRedirect(
  paymentGateway: PaymentGatewayInput,
  paymentDetail: PaymentDetail,
  renderOptions: GatewayRenderOptions,
): RenderedRedirect {
  const templateContext = buildGatewayContext(
    paymentGateway,
    paymentDetail,
    renderOptions,
  );
  const problems: GatewayTemplateProblem[] = [];
  const fields = Object.fromEntries(
    paymentGateway.redirect_fields
      .filter(
        (redirectField) =>
          redirectField.send_on === "always" ||
          renderOptions.redirectOutcome === "success",
      )
      .map((redirectField) => [
        redirectField.name,
        renderPart(
          redirectField.template,
          templateContext,
          `Redirect field ${redirectField.name}`,
          problems,
        ),
      ]),
  );

  return { method: paymentGateway.redirect_method, fields, problems };
}

export type RenderedNotification = {
  eventName: string;
  headers: Record<string, string>;
  body: string;
  problems: GatewayTemplateProblem[];
};

/**
 * A gateway's notification for one event (PY-12.3), or null when it names
 * no event for it, so nothing is sent.
 */
export function renderGatewayNotification(
  paymentGateway: PaymentGatewayInput,
  paymentDetail: PaymentDetail,
  renderOptions: GatewayRenderOptions,
): RenderedNotification | null {
  const eventName = paymentGateway.event_names[renderOptions.eventType] ?? "";
  if (eventName.trim() === "") {
    return null;
  }
  const templateContext = buildGatewayContext(
    paymentGateway,
    paymentDetail,
    renderOptions,
  );
  const problems: GatewayTemplateProblem[] = [];
  const headers = Object.fromEntries(
    paymentGateway.notification_headers.map((headerTemplate) => [
      headerTemplate.name.toLowerCase(),
      renderPart(
        headerTemplate.template,
        templateContext,
        `Header ${headerTemplate.name}`,
        problems,
      ),
    ]),
  );
  const body = renderPart(
    paymentGateway.notification_body,
    templateContext,
    "Notification body",
    problems,
  );

  return {
    eventName,
    headers: {
      "content-type":
        paymentGateway.notification_content_type === "json"
          ? "application/json"
          : "application/x-www-form-urlencoded",
      ...headers,
    },
    body,
    problems,
  };
}
