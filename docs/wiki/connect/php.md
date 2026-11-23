---
title: PHP and Laravel
description: Connect PHP and Laravel apps to SendMock with laravel, Symfony or plain PHP.
---

> See [Connect your app](./index.md) for the ports.

## Laravel with Mailgun and Twilio in one step

The `laravel-mailgun-twilio` preset sets SendMock up for a Laravel app on Mailgun and Twilio: the Mailgun event and inbound webhooks with rules for opened, bounced, complained and inbound mail, Twilio's test sender `+15005550006` with your app's inbound and status URLs, the Twilio Debugger URL and a Mailgun signing key. Running it again changes nothing.

1. Start SendMock with the HTTPS provider port, which Laravel's mailgun mailer needs.

   ```bash
   sendmock --provider-tls-addr 127.0.0.1:8027
   ```

2. Apply the preset with your app's URL. It runs `sendmock trust` first (it asks before changing anything; `--no-trust` skips it).

   ```bash
   sendmock preset laravel-mailgun-twilio --app-url http://localhost:8000
   ```

3. Copy the `.env` lines it prints into your app's `.env`.

Each webhook path has a flag (`--mailgun-events-path`, `--mailgun-inbound-path`, `--twilio-inbound-path`, `--twilio-status-path`, `--twilio-debugger-path`; `sendmock presets` lists the defaults), and `--import-numbers numbers.csv` adds your numbers, one per line as `number,label,subaccount_sid,messaging_service_sid`. A Messaging Service SID that does not exist yet is created with that SID. The whole CSV is checked before anything is set up: if a line has a malformed number or an unknown subaccount, nothing changes and the error names every bad line. Settings > Setup has the same preset under **Presets**.

## Email

Laravel `.env`:

```bash
MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_ENCRYPTION=null
```

Symfony Mailer: `MAILER_DSN=smtp://127.0.0.1:1025`.

## SMS

```php
Http::post('http://127.0.0.1:8025/api/v1/sms', [
    'from' => '+15550001111',
    'to' => '+8801700000000',
    'body' => 'Your code is 482913',
]);
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms/index.md) and [Email](../mail/index.md) pages list the providers.
