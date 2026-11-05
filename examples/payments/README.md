# Payment gateway examples

Each folder uses a gateway's official SDK the way an app does, pointed at SendMock's provider port. CI runs them against a release binary that is cut off from the network (`.github/workflows/payment-apps.yml`): SendMock runs as its own system user, the firewall rejects anything it sends beyond loopback, and the run fails if a single packet was rejected.

- `stripe-node/`: the `stripe` Node SDK creates a Checkout Session, the customer pays on SendMock's checkout page, and the app receives `checkout.session.completed` and `payment_intent.succeeded`, each checked with `stripe.webhooks.constructEvent`. A confirm with `pm_card_chargeDeclined` then throws the SDK's `StripeCardError`, and `payment_intent.payment_failed` arrives. Last, the paid PaymentIntent is refunded and `charge.refunded` arrives. It writes every delivery it received to `../stripe-deliveries.json`.
- `stripe-php/` and `stripe-python/`: the PHP and Python SDKs verify the same deliveries with `\Stripe\Webhook::constructEvent` and `stripe.Webhook.construct_event`.
- `paypal-node/`: PayPal's `@paypal/paypal-server-sdk` creates an order, the buyer approves it on SendMock's checkout page, and the app captures it and receives `PAYMENT.CAPTURE.COMPLETED`, which it checks with `verify-webhook-signature`. An order whose approval was declined fails at capture with `INSTRUMENT_DECLINED`, and the capture is refunded with `PAYMENT.CAPTURE.REFUNDED` received and checked. The SDK only knows PayPal's hosts and has no base URL setting, so the app gives the SDK's HTTP client an axios adapter that sends PayPal's sandbox host to the provider port, and SendMock answers PayPal's real paths.
- `sslcommerz-node/`: SSLCommerz's `sslcommerz-lts` package starts a session, the customer pays on SendMock's checkout page, the IPN arrives and the app checks its `verify_sign`, and the order is validated (`VALID`, then `VALIDATED`). A declined payment sends a `FAILED` IPN, and the paid order is refunded by its `bank_tran_id` and the refund's status queried. The package always calls `sandbox.sslcommerz.com`, so the app points its address fields at the provider port.
- `razorpay-node/`: Razorpay's `razorpay` Node SDK creates an order, the customer pays it on SendMock's checkout page, and the app checks the `razorpay_signature` posted to its `callback_url` with the SDK's `validatePaymentVerification`, fetches the captured payment and receives `payment.captured`, checked with `validateWebhookSignature`. A declined card sends `payment.failed`, and the payment is refunded with `refund.processed` received and checked. Checkout's `callback_url` lives in the browser, so the order carries it in `notes.callback_url`; the SDK only knows `api.razorpay.com`, so the app points its HTTP client at the provider port.

To run them by hand:

1. Start SendMock with the provider port.

   ```sh
   sendmock --db memory --provider-addr 127.0.0.1:8026
   ```

2. Go to the Node example.

   ```sh
   cd examples/payments/stripe-node
   ```

3. Install the Stripe SDK.

   ```sh
   bun install
   ```

4. Pay, receive the webhooks and handle a decline.

   ```sh
   node done-when.js
   ```

5. Verify the deliveries with the PHP SDK.

   ```sh
   cd ../stripe-php
   ```

   ```sh
   composer install
   ```

   ```sh
   php verify.php
   ```

6. Verify them with the Python SDK.

   ```sh
   cd ../stripe-python
   ```

   ```sh
   pip install -r requirements.txt
   ```

   ```sh
   python verify.py
   ```

7. Pay, check the IPN, validate, decline and refund with SSLCommerz's Node package.

   ```sh
   cd ../sslcommerz-node
   ```

   ```sh
   bun install
   ```

   ```sh
   node done-when.js
   ```

8. Capture, check the webhooks, decline and refund with PayPal's Node SDK.

   ```sh
   cd ../paypal-node
   ```

   ```sh
   bun install
   ```

   ```sh
   node done-when.js
   ```
