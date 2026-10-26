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

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms/index.md) and [Email](../mail/index.md) pages list the providers.

## Test helper

Save this as `sendmock.js`. The code examples in the [recipes](../recipes/index.md) use it to call SendMock and your app.

```js title="sendmock.js"
export const SENDMOCK = "http://127.0.0.1:8025/api/v1";
export const APP = "http://localhost:3000";

/** Calls SendMock or your app; returns the JSON answer, or null when there is none. */
export async function call(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${method} ${url} answered ${response.status}`);
  }
  const isJson = response.headers.get("content-type")?.includes("json") ?? false;

  return isJson ? response.json() : null;
}
```
