---
title: Troubleshooting
description: Common problems connecting an app to SendMock and how to fix them.
---

> **This page fills in as the server ships; the answers below apply from the first beta.**

## My app cannot connect

- Check SendMock runs: `sendmock health`, or open `http://127.0.0.1:8025`.
- From a Docker container, `127.0.0.1` is the container itself. Use `host.docker.internal` (or the SendMock service name in Docker Compose).

## The email arrived but the client rejected it

Look in **Logs > SMTP sessions**: failed sessions are kept with the reason, such as a wrong password or a message over the size limit.

## The webhook never reached my app

Open the delivery in **Webhooks > Deliveries**: it shows the request, the response or connection error and every retry. **Replay** sends it again after you fix your app.

## Nothing shows up in Mail or SMS

Check **Logs**: a rejected SMTP session or API request is kept with the reason, even though no message was stored. See [Logs](./logs.md).

## An SMS or email was refused on purpose

Twilio's test numbers, the magic addresses, your own outcome rules and **Settings > Chaos** all refuse messages by design. **Test a number** and **Test an address** in Settings tell you which applies. See [Delivery and test numbers](./sms/delivery-and-test-numbers.md) and [Outcomes](./mail/outcomes.md).
