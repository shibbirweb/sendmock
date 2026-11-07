---
title: Subscriptions in depth
description: Every control and text of Payments > Subscriptions and New subscription.
---

> Every control and text this screen shows, in screen order. The list is read from the demo by a crawl, and CI fails when the screen changes without its entry here.

Payments > Subscriptions tests renewals, failed renewal payments and cancellations, each subscription on its own clock.

The screen as a whole: [Subscriptions](../../payments/subscriptions.md).

## On the screen

### 1. Subscriptions

Heading.

- **What it does:** Names the screen, in the header and above the list.

### 2. Read the Subscriptions guide

Link.

- **What it does:** Opens this screen's page in the user guide, in a new tab.
- **Links to:** [Subscriptions](../../payments/subscriptions.md).

### 3. Subscriptions

Heading.

- **What it does:** Names the screen, in the header and above the list.

### 4. Each subscription keeps its own clock: advance it to charge the next renewal through its gateway, or cancel it.

Text.

- **What it does:** Explains the screen: renewals happen when you advance a subscription's clock, not on the calendar.
- **Same action elsewhere:** REST [`GET /api/v1/payments/subscriptions`](/api/payments/#getPaymentsSubscriptions), CLI [`sendmock payments subscriptions list`](/cli/payments/#payments-subscriptions-list), MCP [`sendmock_subscription_list`](/mcp/payments/#sendmock_subscription_list)

### 5. New subscription

Button.

- **What it does:** Opens New subscription.

### 6. No subscriptions yet

Text.

- **What it does:** Shown while there is none.

### 7. Start one with New subscription, or POST /api/v#/payments/subscriptions, to test renewals, failed payments and cancellations.

Text.

- **What it does:** Explains how to start one.

## New subscription dialog

### 8. New subscription

Heading.

- **What it does:** The New subscription dialog.

### 9. Without a trial the first period is charged at once.

Text.

- **What it does:** Explains the first charge.

### 10. Gateway

Drop-down.

- **What it does:** The gateway renewals are charged through.

### 11. Interval

Drop-down.

- **What it does:** How often it renews: daily, weekly, monthly or yearly.

### 12. Customer email

Field.

- **What it does:** The customer's email.

### 13. Plan name

Field.

- **What it does:** The plan's name.

### 14. Amount

Field.

- **What it does:** What each period costs.

### 15. Currency

Field.

- **What it does:** The currency code.

### 16. Trial days

Field.

- **What it does:** Free days before the first charge.

### 17. Test card

Field.

- **What it does:** The test card renewals use; a declining card makes renewals fail.

### 18. Cancel

Button.

- **What it does:** Closes the dialog without doing anything.

### 19. Start subscription

Button.

- **What it does:** Starts the subscription.
- **What it changes:** Fires `subscription.created`, and a payment for the first period when there is no trial.
- **Same action elsewhere:** REST [`POST /api/v1/payments/subscriptions`](/api/payments/#postPaymentsSubscriptions), CLI [`sendmock payments subscriptions create`](/cli/payments/#payments-subscriptions-create), MCP [`sendmock_subscription_create`](/mcp/payments/#sendmock_subscription_create)

### 20. Close

Button.

- **What it does:** Closes the dialog.

## When the data cannot load

### 21. Could not load the subscriptions. Try again

Message.

- **What it does:** Shown when the subscriptions could not be loaded.
- **Errors:** Check SendMock is running, then press Try again.

### 22. Could not load the subscriptions.

Text.

- **What it does:** The message inside the alert.

### 23. Try again

Button.

- **What it does:** Loads them again.
- **Same action elsewhere:** REST [`GET /api/v1/payments/subscriptions`](/api/payments/#getPaymentsSubscriptions), CLI [`sendmock payments subscriptions list`](/cli/payments/#payments-subscriptions-list), MCP [`sendmock_subscription_list`](/mcp/payments/#sendmock_subscription_list)
