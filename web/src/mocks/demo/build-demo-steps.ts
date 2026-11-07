import type { EmailAddress } from "@/lib/api/types";
import { buildStandardEmailFixtures } from "@/mocks/fixtures/email-fixtures";
import { seedFixtureRandomness } from "@/mocks/fixtures/fixture-helpers";
import { buildHttpBinFixtures } from "@/mocks/fixtures/http-catcher-fixtures";
import { buildStandardSmsFixtures } from "@/mocks/fixtures/sms-fixtures";
import {
  buildWebhookEndpointFixtures,
  buildWebhookRuleFixtures,
} from "@/mocks/fixtures/webhook-fixtures";
import type { WebhookEndpointRecord } from "@/mocks/webhooks/webhook-endpoint-record";

/**
 * One call `sendmock --demo` makes through the operation registry, as an API client would
 * (PL-09). A string `{{http_address}}` is SendMock's own HTTP address, and
 * `{{saved.<name>.<field>}}` a field of an earlier step's answer saved under `<name>`.
 */
export type DemoStep = {
  operation_id: string;
  input: Record<string, unknown>;
  save_as?: string;
};

const testCard = {
  number: "4242424242424242",
  exp_month: 12,
  exp_year: 2034,
  cvc: "123",
  holder_name: "Rahim Uddin",
};

/** Card checkouts paid, declined and left open; PayPal pays through its own account flow. */
const demoPayments = [
  { provider: "stripe", amount_minor: 4999, currency: "USD", outcome: "pay" },
  { provider: "stripe", amount_minor: 1250, currency: "EUR", outcome: "pay" },
  {
    provider: "stripe",
    amount_minor: 8900,
    currency: "USD",
    outcome: "decline",
  },
  {
    provider: "sslcommerz",
    amount_minor: 150000,
    currency: "BDT",
    outcome: "pay",
  },
  { provider: "stripe", amount_minor: 2000, currency: "USD", outcome: "open" },
] as const;

function formatAddress(emailAddress: EmailAddress): string {
  return emailAddress.name === ""
    ? emailAddress.address
    : `${emailAddress.name} <${emailAddress.address}>`;
}

/** Endpoints post to SendMock's own catcher, so their deliveries stay on the machine. */
function toLocalCatchUrl(endpointName: string): string {
  const binName = endpointName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `http://{{http_address}}/catch/demo-${binName}`;
}

/** The fields `POST /webhooks/endpoints` takes; the rest of a record is kept by the server. */
const endpointInputFields = [
  "name",
  "method",
  "headers",
  "extra_fields",
  "template_id",
  "template_mode",
  "timeout_ms",
  "retry_policy",
  "query_params",
  "body_mode",
  "body_fields",
  "fields_encoding",
  "raw_content_type",
  "raw_body",
  "render_mode",
] as const satisfies readonly (keyof WebhookEndpointRecord)[];

function buildHttpBinSteps(): DemoStep[] {
  return buildHttpBinFixtures().map((httpBin) => ({
    operation_id: "postHttpBins",
    input: { name: httpBin.name, preset: httpBin.preset },
  }));
}

function buildWebhookSteps(): DemoStep[] {
  const webhookEndpoints = buildWebhookEndpointFixtures();
  const endpointSteps = webhookEndpoints.map(
    (webhookEndpoint, endpointIndex): DemoStep => {
      const endpointInput = Object.fromEntries(
        endpointInputFields.map((fieldName) => [
          fieldName,
          webhookEndpoint[fieldName],
        ]),
      );
      return {
        operation_id: "postWebhooksEndpoints",
        // Every demo endpoint is on: they all post to the local catcher.
        input: {
          ...endpointInput,
          url: toLocalCatchUrl(webhookEndpoint.name),
          is_enabled: true,
        },
        save_as: `endpoint_${endpointIndex}`,
      };
    },
  );
  const ruleSteps = buildWebhookRuleFixtures(webhookEndpoints).map(
    (webhookRule): DemoStep => {
      const endpointIndex = webhookEndpoints.findIndex(
        (webhookEndpoint) => webhookEndpoint.id === webhookRule.endpoint_id,
      );
      return {
        operation_id: "postWebhooksRules",
        input: {
          name: webhookRule.name,
          endpoint_id: `{{saved.endpoint_${endpointIndex}.id}}`,
          events: webhookRule.events,
          filter: webhookRule.filter,
          is_enabled: webhookRule.is_enabled,
        },
      };
    },
  );
  return [...endpointSteps, ...ruleSteps];
}

function buildEmailSteps(): DemoStep[] {
  return buildStandardEmailFixtures()
    .map((emailFixture) => emailFixture.email)
    .filter((emailDetail) => emailDetail.direction === "outbound")
    .reverse()
    .map((emailDetail) => ({
      operation_id: "postSend",
      input: {
        from: formatAddress(emailDetail.from),
        to: emailDetail.to.map(formatAddress),
        cc: emailDetail.cc.map(formatAddress),
        subject: emailDetail.subject,
        ...(emailDetail.text_body === null
          ? {}
          : { text: emailDetail.text_body }),
        ...(emailDetail.html_body === null
          ? {}
          : { html: emailDetail.html_body }),
        tags: emailDetail.tags,
      },
    }));
}

function buildSmsSteps(): DemoStep[] {
  return buildStandardSmsFixtures()
    .slice()
    .reverse()
    .map((smsMessage) =>
      smsMessage.direction === "outbound"
        ? {
            operation_id: "postSms",
            input: {
              from: smsMessage.from_number,
              to: smsMessage.to_number,
              body: smsMessage.body,
            },
          }
        : {
            operation_id: "postSmsInbound",
            input: {
              from: smsMessage.from_number,
              to: smsMessage.to_number,
              body: smsMessage.body,
              channel: smsMessage.channel,
            },
          },
    );
}

function buildSampleSteps(): DemoStep[] {
  return ["verification", "http"].map((sampleKind) => ({
    operation_id: "postSamplesByKind",
    input: { kind: sampleKind },
  }));
}

function buildPaymentSteps(): DemoStep[] {
  return demoPayments.flatMap((demoPayment, paymentIndex): DemoStep[] => {
    const checkoutName = `checkout_${paymentIndex}`;
    const checkoutStep: DemoStep = {
      operation_id: "postPaymentsCheckout",
      input: {
        provider: demoPayment.provider,
        amount_minor: demoPayment.amount_minor,
        currency: demoPayment.currency,
        customer_email: "rahim@example.com",
      },
      save_as: checkoutName,
    };
    if (demoPayment.outcome === "open") {
      return [checkoutStep];
    }
    const completionInput =
      demoPayment.outcome === "pay"
        ? { action: "pay", method_key: "card", card: testCard }
        : {
            action: "decline",
            method_key: "card",
            card: testCard,
            decline_reason: "insufficient_funds",
          };
    return [
      checkoutStep,
      {
        operation_id: "postCheckoutSessionsBySessionIdComplete",
        input: {
          session_id: `{{saved.${checkoutName}.id}}`,
          ...completionInput,
        },
      },
    ];
  });
}

/**
 * The website demo's sample data as operation calls, in the order the binary runs them: bins
 * and webhooks first, so the traffic after them fires the rules.
 */
export function buildDemoSteps(): DemoStep[] {
  seedFixtureRandomness();
  return [
    ...buildHttpBinSteps(),
    ...buildWebhookSteps(),
    ...buildEmailSteps(),
    ...buildSmsSteps(),
    ...buildSampleSteps(),
    ...buildPaymentSteps(),
  ];
}
