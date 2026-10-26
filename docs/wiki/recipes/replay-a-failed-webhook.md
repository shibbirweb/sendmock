---
title: Replay a failed webhook
description: Find a failed delivery, read what your handler got and answered, fix it, and send the same request again.
---

> Works in your install from Phase 3. Try it in the [demo](/demo/webhooks/deliveries) today.

**The situation:** a webhook handler in your app returned 500 (or timed out). You want to see exactly what it received, fix it, and try again without making the event happen again.

**You need:** nothing beyond an endpoint that received a delivery.

## Steps

1. Notice it: the bell shows a failed delivery, the **Overview** lists it under **Recent failures**, or open **Webhooks > Deliveries** and press **Failed**.
2. Open the delivery. The request (method, URL, headers, body) is on the left and your app's response on the right. **Attempts** lists every retry.
3. Fix your handler. If the delivery is still retrying, you can wait for the next attempt, or press **Cancel retries**.
4. Press **Replay** > **Replay as-is**. A new delivery is sent with the same request.
5. To test a variation, press **Edit and replay**, change the body, and **Send edited request**.

## Keep it for next time

Press **Save** and name it ("Order webhook with null address"). It is now in **Webhooks > Saved**, ready to **Send** after every change, and it goes into the seed file.

## With the CLI

```bash
sendmock webhook deliveries list --failed
sendmock webhook deliveries replay <deliveryId>
```

## What you should see

The new delivery with trigger "replay" and, after your fix, a 2xx.

## Try it in the demo

1. Open [Webhooks > Deliveries](/demo/webhooks/deliveries) and press **Failed**.
2. Open the first delivery.
3. Press **Replay** > **Replay as-is**. The drawer now shows the new delivery, with trigger "replay".

## Next

- [Deliveries](../webhooks/deliveries.md)
- [Composer and Saved](../webhooks/composer-and-saved.md)
