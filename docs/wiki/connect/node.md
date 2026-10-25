---
title: Node.js
description: Connect Node.js apps to SendMock with nodemailer and fetch.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

## Email

```js
const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 1025,
  secure: false,
});
```

## SMS

```js
await fetch("http://127.0.0.1:8025/api/v1/sms", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    from: "+15550001111",
    to: "+8801700000000",
    body: "Your code is 482913",
  }),
});
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms.md) and [Email](../email.md) pages list the providers.
