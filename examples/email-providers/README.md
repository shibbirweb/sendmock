# Email provider examples

`node/` sends one email with each email provider's official Node SDK (SendGrid, Mailgun, Postmark, Resend, Amazon SES v2 and Brevo), each pointed at SendMock's provider port by the SDK's own base URL setting, then reads every message back through `GET /api/v1/emails` and checks Resend refuses a send without a subject. CI runs it against a release binary cut off from the network (`.github/workflows/email-provider-sdks.yml`).

To run it by hand:

1. Start SendMock with the provider port.

   ```sh
   sendmock --db memory --provider-addr 127.0.0.1:8026
   ```

2. Go to the example.

   ```sh
   cd examples/email-providers/node
   ```

3. Install the SDKs.

   ```sh
   bun install
   ```

4. Send with every SDK.

   ```sh
   node done-when.js
   ```
