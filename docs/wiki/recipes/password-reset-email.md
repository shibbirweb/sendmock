---
title: Password reset email
description: Catch your app's password reset email, check it, and follow its link to finish the reset.
---

> Works in your install from Phase 1. Try it in the [demo](/demo/mail) today.

**The situation:** you are building or changing password reset. You want to click the reset link without a real inbox, and check the email looks right.

**You need:** your app's mail settings pointing at SendMock (`127.0.0.1:1025`). See [Connect your app](../connect/index.md).

## Steps

1. In your app, request a password reset for any address, for example `rahim@example.test`.
2. In SendMock, open **Mail**. The reset email is at the top.
3. Open it. Under the header, the extracted panel lists the reset link with **Copy link**.
4. Click the link (it opens in a new tab) and finish the reset in your app.
5. Check the email: switch the **HTML** tab to **Mobile width**, and read the **Text** tab for people without HTML.

## In a test

```bash
sendmock email wait --to rahim@example.test --subject "Reset your password" --timeout 10s
sendmock links --to rahim@example.test
```

`sendmock links` prints the links of the latest email to that address, so a test can open the reset page.

## What you should see

The email in Mail within a second, the link in the extracted panel, and your app's reset page when you open it.

## Try it in the demo

1. Open [Mail](/demo/mail) and click **Reset your password**.
2. The extracted panel shows `https://acme.test/reset?token=9f8e7d6c` with **Copy link**.
3. Press **Mobile width** to see the email at phone width.

## Next

- [Read a one-time code](./read-a-code.md)
- [Reading and checks](../mail/reading-and-checks.md)
