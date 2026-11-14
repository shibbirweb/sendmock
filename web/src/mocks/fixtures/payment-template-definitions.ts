import type { TemplateDefinition } from "@/mocks/fixtures/template-definitions";

const jsonType = "application/json";
const formType = "application/x-www-form-urlencoded";
const verifiedOn = "2026-11-05";

/** The payment's main id at the provider, as its API names it. */
const providerReference = "data.provider_reference";
const unixCreated = `{{ event.created_at | date("%s") }}`;

const stripeEventBody = `{
  "id": "evt_{{ random_string(24) }}",
  "object": "event",
  "api_version": "2024-06-20",
  "created": ${unixCreated},
  "data": {
    "object": {
      "id": "{{ data.provider_ids.payment_intent | default(${providerReference}) }}",
      "object": "payment_intent",
      "amount": {{ data.amount_minor }},
      "amount_received": {{ data.captured_minor | default("0") }},
      "currency": "{{ data.currency | lower }}",
      "last_payment_error": {% if data.failure_code %}{"type": "card_error", "code": "card_declined", "decline_code": "{{ data.failure_code }}"}{% else %}null{% endif %},
      "livemode": false,
      "metadata": {{ data.metadata | json }},
      "receipt_email": {% if data.customer_email %}"{{ data.customer_email }}"{% else %}null{% endif %},
      "status": "{{ event.type | payment_event("stripe_status") }}"
    }
  },
  "livemode": false,
  "pending_webhooks": 1,
  "request": {
    "id": null,
    "idempotency_key": null
  },
  "type": "{{ event.type | payment_event("stripe") }}"
}`;

const paypalWebhookBody = `{
  "id": "WH-{{ random_string(17) | upper }}",
  "event_version": "1.0",
  "create_time": "{{ event.created_at }}",
  "resource_type": "capture",
  "resource_version": "2.0",
  "event_type": "{{ event.type | payment_event("paypal") }}",
  "summary": "Payment {{ event.type | payment_event("paypal_status") | lower }}: {{ data.amount_major }} {{ data.currency }}",
  "resource": {
    "id": "{{ data.provider_ids.capture | default(${providerReference}) }}",
    "status": "{{ event.type | payment_event("paypal_status") }}",
    "amount": {
      "currency_code": "{{ data.currency }}",
      "value": "{{ data.amount_major }}"
    },
    "final_capture": true,
    "supplementary_data": {
      "related_ids": {
        "order_id": "{{ data.provider_ids.order | default(${providerReference}) }}"
      }
    },
    "create_time": "{{ data.created_at }}",
    "update_time": "{{ event.created_at }}"
  }
}`;

const paypalIpnBody = `mc_gross={{ data.amount_major }}&protection_eligibility=Eligible&payment_date={{ event.created_at | date("%H:%M:%S %b %d, %Y UTC") | urlencode }}&payment_status={{ event.type | payment_event("paypal_ipn") }}&charset=UTF-8&mc_fee=0.00&notify_version=3.9&payer_status=verified&business={{ vars.paypal_business_email | default("merchant@example.com") | urlencode }}&quantity=1&payer_email={{ data.customer_email | default("buyer@example.com") | urlencode }}&txn_id={{ ${providerReference} }}&payment_type=instant&receiver_email={{ vars.paypal_business_email | default("merchant@example.com") | urlencode }}&txn_type=web_accept&item_name={{ data.provider_name | urlencode }}%20test%20order&mc_currency={{ data.currency }}&test_ipn=1&custom={{ data.id }}&payer_id={{ random_string(13) | upper }}&verify_sign={{ random_string(56) }}&ipn_track_id={{ random_hex(13) }}`;

const sslcommerzStatus = `event.type | payment_event("sslcommerz")`;
const sslcommerzTranId = `data.provider_ids.tran_id | default(${providerReference})`;
const sslcommerzValId = `data.provider_ids.val_id | default("")`;
const sslcommerzIpnBody = `status={{ ${sslcommerzStatus} }}&tran_date={{ event.created_at | date("%Y-%m-%d %H:%M:%S") | urlencode }}&tran_id={{ ${sslcommerzTranId} | urlencode }}&val_id={{ ${sslcommerzValId} | urlencode }}&amount={{ data.amount_major }}&store_amount={{ data.amount_major }}&currency={{ data.currency }}&bank_tran_id={{ random_hex(16) }}&card_type={{ data.method_key | default("") | upper }}&currency_type={{ data.currency }}&currency_amount={{ data.amount_major }}&currency_rate=1.0000&risk_level=0&risk_title=Safe&verify_sign={{ sslcommerz_verify_sign(vars.sslcommerz_store_password, {"amount": data.amount_major, "currency": data.currency, "status": ${sslcommerzStatus}, "tran_id": ${sslcommerzTranId}, "val_id": ${sslcommerzValId}}) }}&verify_key=amount%2Ccurrency%2Cstatus%2Ctran_id%2Cval_id`;

const bkashCallbackBody = `paymentID={{ data.provider_ids.payment_id | default(${providerReference}) | urlencode }}&status={{ event.type | payment_event("bkash") }}&signature={{ random_hex(32) }}&apiVersion=1.2.0-beta`;

const razorpayWebhookBody = `{
  "entity": "event",
  "account_id": "acc_{{ random_string(14) }}",
  "event": "{{ event.type | payment_event("razorpay") }}",
  "contains": ["payment"],
  "payload": {
    "payment": {
      "entity": {
        "id": "{{ data.provider_ids.payment | default(${providerReference}) }}",
        "entity": "payment",
        "amount": {{ data.amount_minor }},
        "currency": "{{ data.currency }}",
        "status": "{{ event.type | payment_event("razorpay_status") }}",
        "order_id": {% if data.provider_ids.order %}"{{ data.provider_ids.order }}"{% else %}null{% endif %},
        "method": "{{ data.method_key | default("card") }}",
        "captured": {% if event.type == "payment.succeeded" %}true{% else %}false{% endif %},
        "email": "{{ data.customer_email | default("") }}",
        "error_code": {% if data.failure_code %}"BAD_REQUEST_ERROR"{% else %}null{% endif %},
        "error_reason": {% if data.failure_code %}"{{ data.failure_code }}"{% else %}null{% endif %},
        "created_at": {{ data.created_at | date("%s") }}
      }
    }
  },
  "created_at": ${unixCreated}
}`;

const paddleWebhookBody = `{
  "event_id": "evt_{{ random_string(26) | lower }}",
  "event_type": "{{ event.type | payment_event("paddle") }}",
  "occurred_at": "{{ event.created_at }}",
  "notification_id": "ntf_{{ random_string(26) | lower }}",
  "data": {
    "id": "{{ data.provider_ids.transaction | default(${providerReference}) }}",
    "status": "{{ event.type | payment_event("paddle_status") }}",
    "origin": "web",
    "currency_code": "{{ data.currency }}",
    "created_at": "{{ data.created_at }}",
    "custom_data": {{ data.metadata | json }},
    "details": {
      "totals": {
        "total": "{{ data.amount_minor }}",
        "currency_code": "{{ data.currency }}"
      }
    }
  }
}`;

/**
 * The payment gateways' notifications as webhook templates, read from a
 * payment event's `data` (docs/plan/13-webhook-templates.md): each provider's
 * own event names, payload and signature header.
 */
export const paymentTemplateDefinitions: Record<string, TemplateDefinition> = {
  "stripe.event": {
    method: "POST",
    content_type: jsonType,
    header_templates: {
      "Stripe-Signature": "{{ stripe_signature(vars.stripe_webhook_secret) }}",
      "User-Agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)",
    },
    body_template: stripeEventBody,
    doc_url: "https://docs.stripe.com/api/events/object",
    verified_on: verifiedOn,
  },
  "paypal.webhook": {
    method: "POST",
    content_type: jsonType,
    header_templates: {
      "PAYPAL-TRANSMISSION-ID": "{{ uuid() }}",
      "PAYPAL-TRANSMISSION-TIME": "{{ now_iso() }}",
      "PAYPAL-TRANSMISSION-SIG": "{{ random_string(88) }}",
      "PAYPAL-CERT-URL":
        "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-a5cafa77",
      "PAYPAL-AUTH-ALGO": "SHA256withRSA",
    },
    body_template: paypalWebhookBody,
    doc_url: "https://developer.paypal.com/api/rest/webhooks/event-names/",
    verified_on: verifiedOn,
  },
  "paypal.ipn": {
    method: "POST",
    content_type: formType,
    header_templates: {},
    body_template: paypalIpnBody,
    doc_url:
      "https://developer.paypal.com/api/nvp-soap/ipn/IPNandPDTVariables/",
    verified_on: verifiedOn,
  },
  "sslcommerz.ipn": {
    method: "POST",
    content_type: formType,
    header_templates: {},
    body_template: sslcommerzIpnBody,
    doc_url: "https://developer.sslcommerz.com/doc/v4/#ipn",
    verified_on: verifiedOn,
  },
  "bkash.callback": {
    method: "POST",
    content_type: formType,
    header_templates: {},
    body_template: bkashCallbackBody,
    doc_url: "https://developer.bka.sh/docs/create-payment-2",
    verified_on: verifiedOn,
  },
  "razorpay.webhook": {
    method: "POST",
    content_type: jsonType,
    header_templates: {
      "X-Razorpay-Signature":
        "{{ razorpay_signature(vars.razorpay_webhook_secret) }}",
      "X-Razorpay-Event-Id": "{{ event.id }}",
    },
    body_template: razorpayWebhookBody,
    doc_url: "https://razorpay.com/docs/webhooks/payloads/payments/",
    verified_on: verifiedOn,
  },
  "paddle.webhook": {
    method: "POST",
    content_type: jsonType,
    header_templates: {
      "Paddle-Signature": "{{ paddle_signature(vars.paddle_webhook_secret) }}",
    },
    body_template: paddleWebhookBody,
    doc_url:
      "https://developer.paddle.com/webhooks/transactions/transaction-completed",
    verified_on: verifiedOn,
  },
};
