---
title: Failed SMS
description: Make SMS fail with Twilio's real error codes, at send time or after, and check how your app handles it.
---

> Works in your install from Phase 2. Try it in the [demo](/demo/settings?section=sms) today.

**The situation:** your app should handle an SMS that cannot be sent (invalid number, opted out) and one that is accepted but never arrives (unreachable handset, carrier filter). On Twilio these are hard to produce on demand.

**You need:** your app's SMS client pointing at SendMock (`http://127.0.0.1:8026` for Twilio SDKs, or the native API). See [Connect your app](../connect/index.md).

## Steps

1. **Fail at send time.** Send from your app to `+15005550001`. SendMock answers at once with HTTP 400 and Twilio's error JSON, code `21211` (invalid number), exactly as Twilio's test credentials do. Your app should show its error.
2. **Fail after sending.** Send to `+15005550103`. The message is accepted, then turns **undelivered** with `30007` (filtered by the carrier), and your status callback is called with it.
3. Open the conversation in **SMS**: the failed message shows a red tick with the code on hover; **Message details** shows the status history and each callback attempt.

Other numbers and codes are on [Delivery and test numbers](../sms/delivery-and-test-numbers.md).

## With cURL

```bash
curl -s http://127.0.0.1:8025/api/v1/sms \
  -H 'content-type: application/json' \
  -d '{"from": "+15550001111", "to": "+15005550001", "body": "Hi"}'
# 400: Rejected with error 21211 (magic number)
```

## What you should see

The 400 with code 21211 in your app's logs for the first send; for the second, an undelivered message and your callback handler receiving `30007`.

## Try it in the demo

1. Open [Settings > SMS](/demo/settings?section=sms).
2. Type `+15005550001` in **Test a number**: it says "Magic number: Invalid number (21211)".
3. Type `+15559990000`: a custom rule applies, "Accepted, then undelivered, 30007".

## Next

- [Advanced: SMS outcome numbers](../advanced/sms-outcome-numbers.md): your own failing numbers.
- [Delivery and test numbers](../sms/delivery-and-test-numbers.md)
