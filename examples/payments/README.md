# Payment gateway examples

Each folder uses a gateway's official SDK the way an app does, pointed at SendMock's provider port. CI runs them against a release binary (`.github/workflows/stripe-sdks.yml`).

- `stripe-node/`: the `stripe` Node SDK creates a Checkout Session, the customer pays on SendMock's checkout page, and the app receives `checkout.session.completed` and `payment_intent.succeeded`, each checked with `stripe.webhooks.constructEvent`. A confirm with `pm_card_chargeDeclined` then throws the SDK's `StripeCardError`, and `payment_intent.payment_failed` arrives. It writes every delivery it received to `../stripe-deliveries.json`.
- `stripe-php/` and `stripe-python/`: the PHP and Python SDKs verify the same deliveries with `\Stripe\Webhook::constructEvent` and `stripe.Webhook.construct_event`.

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
