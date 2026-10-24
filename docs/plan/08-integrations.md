# 08. Language Integrations

SendMock needs no SDK. Email uses SMTP or a provider-compatible HTTP API, SMS uses HTTP. This page is the draft for the user-facing "Connect your app" guide. Each snippet will get a runnable sample app under `examples/<language>/` and a CI smoke test.

Defaults assumed below: SMTP `127.0.0.1:1025`, HTTP `http://127.0.0.1:8025`, provider port (when enabled) `http://127.0.0.1:8026`.

## Email

### SMTP

| Stack | Configuration |
|-------|---------------|
| PHP / Laravel | `.env`: `MAIL_MAILER=smtp`, `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025`, `MAIL_ENCRYPTION=null` |
| PHP / Symfony | `MAILER_DSN=smtp://127.0.0.1:1025` |
| PHP / plain `mail()` | `php.ini`: `sendmail_path = "/usr/local/bin/sendmock sendmail -t"` |
| Node / Nodemailer | `nodemailer.createTransport({ host: '127.0.0.1', port: 1025, secure: false });` |
| Python / smtplib | `smtplib.SMTP('127.0.0.1', 1025)` |
| Python / Django | `EMAIL_HOST = '127.0.0.1'`, `EMAIL_PORT = 1025` |
| Go / net/smtp | `smtp.SendMail("127.0.0.1:1025", nil, from, to, msg)` |
| Java / Spring Boot | `spring.mail.host=127.0.0.1`, `spring.mail.port=1025` |
| Rust / lettre | `SmtpTransport::builder_dangerous("127.0.0.1").port(1025).build()` |
| Ruby / Rails | `config.action_mailer.smtp_settings = { address: '127.0.0.1', port: 1025 }` |
| .NET / MailKit | `client.Connect("127.0.0.1", 1025, SecureSocketOptions.None)` |

### Email provider HTTP APIs

For apps that send through SendGrid, Mailgun, Postmark, Resend, SES or Brevo SDKs (see [03-email.md](03-email.md#http-send-apis)), point the SDK's base URL at the provider port:

| Provider SDK | Typical override (to verify per SDK in Phase 4) |
|--------------|---------------------------------------------------|
| Resend | base URL option / `RESEND_BASE_URL` env -> `http://127.0.0.1:8026` |
| Postmark | API base URL option -> `http://127.0.0.1:8026` |
| Mailgun | `url` / endpoint option -> `http://127.0.0.1:8026` |
| SendGrid | client host option or custom HTTP client -> `http://127.0.0.1:8026` |
| SES v2 (AWS SDK) | `endpoint` option -> `http://127.0.0.1:8026` |
| Laravel mailers (`resend`, `postmark`, `mailgun`, `ses`) | endpoint/host config keys in `config/services.php` |

Or use the native API from any language:

```bash
curl -X POST http://127.0.0.1:8025/api/v1/send \
  -H 'Content-Type: application/json' \
  -d '{"from":"app@app.test","to":["user@example.com"],"subject":"Hi","html":"<p>Hello</p>"}'
```

## SMS

### Native API (works everywhere)

```bash
curl -X POST http://127.0.0.1:8025/api/v1/sms \
  -H 'Content-Type: application/json' \
  -d '{"from":"+15550001111","to":"+8801700000000","body":"Your code is 482913"}'
```

Equivalent minimal snippets for each language (PHP `Http::post`, `fetch`, `requests.post`, `http.Post`, `HttpClient`, `reqwest`, `Net::HTTP`, `HttpClient` in .NET) will be in the guide.

A recommended pattern for apps: define an `SmsSender` interface with a production implementation (real provider) and a local implementation (native SendMock API), switched by env var.

### Provider SDKs (Twilio, Vonage, ...)

Point the SDK at SendMock instead of the provider:

- Use the SDK's base URL / host option where available, targeting the provider port (`--provider-addr 127.0.0.1:8026`) so provider paths resolve at the root. This covers Twilio Messaging, Messaging Services and Verify.
- Otherwise inject a custom HTTP client that rewrites `api.twilio.com`, `verify.twilio.com`, `messaging.twilio.com` (or the vendor host) to `127.0.0.1:8026`.

The exact, tested recipe per official SDK (Twilio PHP, Node, Python, Go, Java, C#, Ruby; Vonage equivalents) is a Phase 4 deliverable; see [10-open-questions.md](10-open-questions.md).

### Laravel notification channel example (draft)

```php
// config/services.php
'twilio' => [
    'base_url' => env('TWILIO_BASE_URL', 'https://api.twilio.com'),
],
```

```dotenv
# .env.local
TWILIO_BASE_URL=http://127.0.0.1:8026
```

## Other outbound HTTP (Slack, push, Telegram, ...)

Point the service's webhook URL or API base URL at the HTTP catcher, e.g. `SLACK_WEBHOOK_URL=http://127.0.0.1:8025/catch/slack`. See [15-http-catcher.md](15-http-catcher.md).

## Receiving webhooks: verifying the signature

Native deliveries follow [Standard Webhooks](https://www.standardwebhooks.com/), so the easiest path is the official library for your language (PHP, JS/TS, Python, Go, Java/Kotlin, Rust, Ruby, C#, Elixir). Package names below are to be re-checked when the guide is written.

Node (`standardwebhooks` on npm):

```js
import { Webhook } from 'standardwebhooks';

const webhook = new Webhook(process.env.SENDMOCK_WEBHOOK_SECRET);
const event = webhook.verify(rawBody, {
  'webhook-id': req.headers['webhook-id'],
  'webhook-timestamp': req.headers['webhook-timestamp'],
  'webhook-signature': req.headers['webhook-signature'],
});
```

Python (`standardwebhooks` on PyPI):

```python
from standardwebhooks.webhooks import Webhook

event = Webhook(secret).verify(raw_body, request.headers)
```

Without a library (PHP shown; same steps in any language):

```php
$key = base64_decode(substr($secret, strlen('whsec_')));
$signedContent = $request->header('webhook-id') . '.' . $request->header('webhook-timestamp') . '.' . $request->getContent();
$expected = 'v1,' . base64_encode(hash_hmac('sha256', $signedContent, $key, true));

$valid = false;
foreach (explode(' ', (string) $request->header('webhook-signature')) as $signature) {
    if (hash_equals($expected, $signature)) {
        $valid = true;
    }
}

if (abs(time() - (int) $request->header('webhook-timestamp')) > 300) {
    $valid = false;
}
```

Provider-format deliveries (Twilio, Mailgun, SendGrid, ...) are verified with the provider's own SDK helpers, unchanged from production.

## Using it in tests

```python
# pytest example: sign up, then read the OTP from sendmock
requests.post(f"{APP}/signup", json={"phone": "+8801700000000"})
otp = requests.get(f"{MSS}/api/v1/otp", params={"to": "+8801700000000", "channel": "sms", "timeout": "10s"}).json()["code"]
```

```ts
// Playwright example
const res = await request.get(`${MSS}/api/v1/wait/email`, { params: { to: 'user@example.com', timeout: '10s' } });
const email = await res.json();
```

### Starting SendMock from a test suite

- **Testcontainers** modules (Java, Node, Go, Python, .NET; Phase 5): `new MssContainer().withSeed("sendmock.seed.toml")` exposes `getSmtpPort()`, `getHttpUrl()`, `getProviderUrl()`.
- **Random ports:** `sendmock serve --smtp-addr 127.0.0.1:0 --http-addr 127.0.0.1:0 --ready-json` binds free ports and prints one JSON line with the chosen addresses once ready, so test harnesses can spawn the binary directly:

```json
{"ready":true,"smtp":"127.0.0.1:53121","http":"http://127.0.0.1:53122","provider":null,"pid":4242}
```

## Docker Compose

```yaml
services:
  sendmock:
    image: ghcr.io/<owner>/sendmock:1
    ports:
      - "8025:8025"   # UI, API, MCP
      - "1025:1025"   # SMTP
      - "8026:8026"   # provider APIs (optional)
    environment:
      SENDMOCK_PROVIDER_ADDR: 0.0.0.0:8026
      SENDMOCK_UI_AUTH: admin:change-me      # recommended when ports are published
    volumes:
      - sendmock-data:/data
      - ./sendmock.seed.toml:/config/sendmock.seed.toml:ro
  app:
    build: .
    environment:
      MAIL_HOST: sendmock
      MAIL_PORT: 1025
      SMS_BASE_URL: http://sendmock:8025
      TWILIO_BASE_URL: http://sendmock:8026
    depends_on:
      sendmock:
        condition: service_healthy

volumes:
  sendmock-data:
```

Inside the image SendMock already listens on `0.0.0.0` and stores data in `/data`; see [09-distribution.md](09-distribution.md#docker). When SendMock calls webhooks on an app running on the host, use `host.docker.internal` (macOS/Windows) or `--add-host=host.docker.internal:host-gateway` (Linux); within Compose, use the service name (`http://app:8000/...`).
