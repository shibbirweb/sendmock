---
title: Read a one-time code
description: Read a sign-up or login code from an email, an SMS or Twilio Verify, by hand or from a test.
---

> Works in your install from Phase 1 (email) and Phase 2 (SMS and Verify). Try it in the [demo](/demo/mail) today.

**The situation:** your app sends a one-time code by email or SMS. You need the code to finish the flow, by hand while developing and from your end-to-end tests.

**You need:** your app's mail or SMS settings pointing at SendMock. See [Connect your app](../connect/index.md).

## Steps

1. Trigger the code in your app (sign up, log in, confirm a phone number).
2. In SendMock, open the email in **Mail**, the conversation in **SMS**, or the verification in **SMS > Verify**.
3. The code is shown on its own with a copy button (**Copy code 482913**). Paste it into your app.

## In a test

```bash
# waits until a code arrives, then prints it
sendmock otp --to user@example.test --wait 10s
sendmock otp --to +8801700000000 --channel sms --wait 10s
```

Agents use the `sendmock_otp_get` MCP tool the same way.

## When no code is found

SendMock finds codes with the patterns in **Settings > OTP patterns**. If your app writes codes differently (for example `ABC-123`), add a pattern: [Advanced: OTP patterns](../advanced/otp-patterns.md).

## What you should see

The code beside the message, and the same code from `sendmock otp`.

## Try it in the demo

1. Open [Mail](/demo/mail) and click **Your verification code**.
2. The code `482913` shows under the header with **Copy code 482913**.

## Next

- [Twilio Verify login](./twilio-verify-login.md)
- [Advanced: OTP patterns](../advanced/otp-patterns.md)
