---
title: Python
description: Connect Python apps to SendMock with smtplib, Django and requests.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

## Email

```python
import smtplib

with smtplib.SMTP("127.0.0.1", 1025) as smtp:
    smtp.send_message(message)
```

Django settings: `EMAIL_HOST = "127.0.0.1"`, `EMAIL_PORT = 1025`.

## SMS

```python
import requests

requests.post(
    "http://127.0.0.1:8025/api/v1/sms",
    json={"from": "+15550001111", "to": "+8801700000000", "body": "Your code is 482913"},
)
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms/index.md) and [Email](../mail/index.md) pages list the providers.
