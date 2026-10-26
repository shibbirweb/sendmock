---
title: PHP and Laravel
description: Connect PHP and Laravel apps to SendMock with laravel, Symfony or plain PHP.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

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
