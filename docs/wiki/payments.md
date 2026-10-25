---
title: Payments
description: Test checkouts for Stripe, PayPal, SSLCommerz and bKash with real redirects and notifications.
---

> **The screens are in the [live demo](/demo/payments). The gateway APIs arrive in Phase 3P.**

![A test checkout page for SSLCommerz](./images/checkout.jpg)

Your app starts a payment through the gateway's real API. SendMock answers with a hosted test checkout page that offers the gateway's methods (cards, mobile wallets, net banking) and then redirects back to your app and posts the IPN or webhook, signed as the gateway does.

- **Test values:** only test cards and test wallet numbers are accepted; each decides the outcome. Settings > Payments lists them for every enabled method.
- **Gateways, methods and flows** are editable: change what a checkout offers, the fields a redirect carries and the steps a method asks for.
- **Simulate** captures, refunds, disputes or fails a payment later, and **Resend notification** posts its IPN again.
