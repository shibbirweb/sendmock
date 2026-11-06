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

## Verifying with the official Standard Webhooks libraries

Four small programs check a native delivery with the official [Standard Webhooks](https://www.standardwebhooks.com) library of their language. Each one starts a local receiver, adds an endpoint for it with a rule for every received email, reveals the endpoint's `whsec_` secret, sends one email, verifies the webhook that arrives and checks that a tampered body is refused. CI runs all four against a release binary.

| Folder | Library |
|--------|---------|
| `node-standard-webhooks` | `standardwebhooks` 1.1.1 (npm) |
| `python-standard-webhooks` | `standardwebhooks` 1.1.0 (PyPI) |
| `php-standard-webhooks` | `standard-webhooks/standard-webhooks` 1.0.2 (Packagist) |
| `go-standard-webhooks` | `github.com/standard-webhooks/standard-webhooks/libraries` 0.0.1 |

To run the Python one by hand, with SendMock started as in step 1 above:

1. Go to its folder.

   ```sh
   cd examples/webhooks/python-standard-webhooks
   ```

2. Install the library.

   ```sh
   pip install -r requirements.txt
   ```

3. Verify a delivery.

   ```sh
   python verify_delivery.py
   ```

The others work the same way: `bun install` then `node verify-delivery.js` for Node, `composer install` then `php verify-delivery.php` for PHP, and `go run .` for Go. Each prints `Verified <webhook-id> (email.received) ...` when the signature checks out.
