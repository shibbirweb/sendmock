# SMS client examples

Each folder uses a provider's official SDK the way an app does, pointed at SendMock's provider port. It sends an SMS with a status callback to a small local handler, waits for the `queued`, `sent` and `delivered` callbacks, then runs a Twilio Verify login with the code read from `/api/v1/otp`. CI runs every one against a release binary (`.github/workflows/sms-clients.yml`).

The SDK keeps its real base URL; a custom HTTP client (the SDK's own extension point) sends each request to the provider port with the same path and query.

To run one by hand:

1. Start SendMock with the provider port.

   ```sh
   sendmock --db memory --provider-addr 127.0.0.1:8026
   ```

2. Go to an example, for example the Node SDK.

   ```sh
   cd examples/sms/node-twilio
   ```

3. Install its SDK.

   ```sh
   bun install
   ```

4. Send and verify.

   ```sh
   node send-and-verify.js
   ```

For the Python SDK, after step 1:

1. Go to its folder.

   ```sh
   cd examples/sms/python-twilio
   ```

2. Install its SDK.

   ```sh
   pip install -r requirements.txt
   ```

3. Send and verify.

   ```sh
   python send_and_verify.py
   ```

The folders: `node-twilio` (twilio 6.2.0) and `python-twilio` (twilio 9.12.0).
