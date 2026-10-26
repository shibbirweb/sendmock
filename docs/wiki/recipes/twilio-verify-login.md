---
title: Twilio Verify login
description: Log in with a Twilio Verify code, then test an expired code, a canceled verification and too many attempts.
---

> Works in your install from Phase 2. Try it in the [demo](/demo/sms/verify) today.

**The situation:** your app logs people in, or confirms phone numbers, with Twilio Verify. The happy path is easy; an expired code or too many wrong tries are not.

**You need:** your app's Twilio client pointing at `http://127.0.0.1:8026`. The Verify service SID your app uses can be created in **SMS > Verify > Services** (or the seed file).

## Steps

1. In your app, start a login with a phone number. A row appears in **SMS > Verify** with the code and "Expires in ..." counting down. The code also arrives as an SMS in **SMS**.
2. Copy the code and enter it in your app. The row turns **Approved** and your app logs in.
3. Start another login. Open the row and press **Expire**. Enter the old code in your app: the check fails as Twilio fails it.
4. Start another and press **Max attempts**, or enter wrong codes until the attempt limit. Your app should stop accepting codes.

## For automated tests

Give the service a **fixed code**: in **Services**, edit it and set **Fixed code (optional)** to `123456`. Every verification then uses that code, so your tests can type it without reading anything.

## What you should see

Approved, expired and max-attempts rows in Verify, each with its timeline, and your app's matching messages.

## Try it in the demo

1. Open [SMS > Verify](/demo/sms/verify) and click a **Pending** verification.
2. In the drawer, press **Expire**. The status changes to **Expired** and the timeline records it.

## Next

- [Verify](../sms/verify.md)
- [Read a one-time code](./read-a-code.md)
