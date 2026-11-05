// An app using SSLCommerz's official Node package (`sslcommerz-lts`) against a running
// SendMock: it starts a session, the customer pays on the checkout page, the IPN arrives with a
// `verify_sign` the app checks, and the order is validated (`VALID`, then `VALIDATED`); a
// declined payment sends a `FAILED` IPN; then the paid order is refunded by its
// `bank_tran_id` and the refund's status is queried.
import SSLCommerzPayment from "sslcommerz-lts";

import { startIpnReceiver } from "./sslcommerz-ipn-receiver.js";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl = process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026";
const storeId = "sendm0000000001";
const storePassword = "sendm0000000001@ssl";
const waitTimeoutMs = 60_000;
const shopUrl = "https://shop.example/sslcommerz";

/** The package always calls sandbox.sslcommerz.com; its addresses are plain fields. */
function pointAtSendMock(sslcommerz) {
  for (const urlField of [
    "initURL",
    "validationURL",
    "refundURL",
    "refundQueryURL",
    "transactionQueryBySessionIdURL",
    "transactionQueryByTransactionIdURL",
  ]) {
    sslcommerz[urlField] = sslcommerz[urlField].replace(sslcommerz.baseURL, providerUrl);
  }
  return sslcommerz;
}

const sslcommerz = pointAtSendMock(new SSLCommerzPayment(storeId, storePassword, false));

async function callSendMock(method, path, requestBody) {
  const response = await fetch(`${sendmockUrl}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  const answerText = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${response.status}: ${answerText}`);
  }
  return answerText === "" ? null : JSON.parse(answerText);
}

function expectEqual(actualValue, expectedValue, description) {
  if (actualValue !== expectedValue) {
    throw new Error(`${description}: expected ${expectedValue}, got ${actualValue}`);
  }
}

async function waitForIpn(receivedIpns, tranId, ipnStatus) {
  const deadline = Date.now() + waitTimeoutMs;
  for (;;) {
    const ipn = receivedIpns.find(
      (receivedIpn) => receivedIpn.tran_id === tranId && receivedIpn.status === ipnStatus,
    );
    if (ipn) {
      return ipn;
    }
    if (Date.now() > deadline) {
      const receivedStatuses = receivedIpns.map((receivedIpn) => receivedIpn.status);
      throw new Error(`Timed out waiting for the ${ipnStatus} IPN; got ${receivedStatuses}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Points the SSLCommerz gateway's IPN at the receiver, as the merchant panel's IPN setting. */
async function connectIpnReceiver(receiverUrl) {
  const endpoint = await callSendMock("POST", "/webhooks/endpoints", {
    name: "SSLCommerz IPN",
    url: receiverUrl,
    is_enabled: true,
    method: "POST",
    headers: {},
    extra_fields: {},
    template_id: "native",
    template_mode: "linked",
    timeout_ms: 10_000,
    retry_policy: { max_attempts: 2, backoff_seconds: [1], retry_on_client_errors: false },
    query_params: [],
    body_mode: "template",
    body_fields: [],
    fields_encoding: "json",
    raw_content_type: "application/json",
    raw_body: "",
    render_mode: "strict",
  });
  const sslcommerzGateway = await callSendMock("GET", "/payments/gateways/sslcommerz");
  await callSendMock("PATCH", "/payments/gateways/sslcommerz", {
    ...sslcommerzGateway,
    notification_endpoint_id: endpoint.id,
  });
}

async function startSession(tranId) {
  const session = await sslcommerz.init({
    total_amount: 450,
    currency: "BDT",
    tran_id: tranId,
    success_url: `${shopUrl}/success`,
    fail_url: `${shopUrl}/fail`,
    cancel_url: `${shopUrl}/cancel`,
    shipping_method: "NO",
    product_name: "Blue mug",
    product_category: "Kitchen",
    product_profile: "general",
    cus_name: "Ruma Akter",
    cus_email: "ruma@example.com",
    cus_phone: "01711111111",
  });
  expectEqual(session.status, "SUCCESS", `Session init (${session.failedreason})`);
  return new URL(session.GatewayPageURL).pathname.split("/").pop();
}

async function payAndValidate(receivedIpns) {
  const paymentId = await startSession("NODE-ORDER-1");
  await callSendMock("POST", `/checkout-sessions/${paymentId}/complete`, {
    action: "pay",
    method_key: "card",
    card: { number: "4242424242424242", exp_month: 12, exp_year: 2034, cvc: "123" },
  });

  const validIpn = await waitForIpn(receivedIpns, "NODE-ORDER-1", "VALID");
  const firstValidation = await sslcommerz.validate({ val_id: validIpn.val_id });
  expectEqual(firstValidation.status, "VALID", "The first validation");
  expectEqual(firstValidation.tran_id, "NODE-ORDER-1", "The validated order");
  expectEqual(Number(firstValidation.amount), 450, "The validated amount");
  const secondValidation = await sslcommerz.validate({ val_id: validIpn.val_id });
  expectEqual(secondValidation.status, "VALIDATED", "The second validation");
  return validIpn;
}

async function handleDecline(receivedIpns) {
  const paymentId = await startSession("NODE-ORDER-2");
  await callSendMock("POST", `/checkout-sessions/${paymentId}/complete`, {
    action: "decline",
    decline_reason: "insufficient_funds",
  });
  const failedIpn = await waitForIpn(receivedIpns, "NODE-ORDER-2", "FAILED");
  expectEqual(failedIpn.val_id ?? "", "", "A failed payment's val_id");
}

async function refundOrder(validIpn) {
  const refund = await sslcommerz.initiateRefund({
    refund_amount: 450,
    refund_remarks: "Customer returned the mug",
    bank_tran_id: validIpn.bank_tran_id,
    refe_id: "RETURN-1",
  });
  expectEqual(refund.status, "success", `The refund (${refund.errorReason})`);
  const refundStatus = await sslcommerz.refundQuery({ refund_ref_id: refund.refund_ref_id });
  expectEqual(refundStatus.status, "refunded", "The refund's status");
  const transactions = await sslcommerz.transactionQueryByTransactionId({
    tran_id: "NODE-ORDER-1",
  });
  expectEqual(Number(transactions.no_of_trans_found), 1, "Transactions found by tran_id");
}

async function main() {
  const receiver = await startIpnReceiver(storePassword);
  await connectIpnReceiver(receiver.receiverUrl);

  const validIpn = await payAndValidate(receiver.receivedIpns);
  await handleDecline(receiver.receivedIpns);
  await refundOrder(validIpn);

  const receivedStatuses = receiver.receivedIpns.map((receivedIpn) => receivedIpn.status);
  console.log(`Done: verified ${receivedStatuses.length} SSLCommerz IPNs (${receivedStatuses}).`);
  receiver.receiverServer.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
