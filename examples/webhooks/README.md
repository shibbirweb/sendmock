# Webhook handler examples

`express-handler` is an Express app that takes SendMock's native webhooks the way your app would: it checks the [Standard Webhooks](https://www.standardwebhooks.com) signature with the endpoint's `whsec_` secret (`webhook-handler.js`, using only `node:crypto`) and keeps the events it accepted.

`done-when.js` runs SendMock's Phase 3 check against it: it adds an endpoint that tries twice, a second apart, and a rule that forwards every `*@inbound.local` email to the handler; sends one email that matches and one that does not; lets the handler fail so the delivery is retried and gives up; fixes the handler and replays the delivery, which then succeeds. CI runs it against a release binary (`.github/workflows/webhook-handler.yml`).

To run it by hand:

1. Start SendMock.

   ```sh
   sendmock --db memory
   ```

2. Go to the example.

   ```sh
   cd examples/webhooks/express-handler
   ```

3. Install Express.

   ```sh
   bun install
   ```

4. Run the check.

   ```sh
   node done-when.js
   ```

It prints `Done: 2 failed attempts, then the replay answered 200.` when every step worked. Set `SENDMOCK_URL` when SendMock listens somewhere other than `http://127.0.0.1:8025`.
