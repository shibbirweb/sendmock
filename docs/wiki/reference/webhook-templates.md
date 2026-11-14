---
title: Built-in webhook templates
description: Every webhook payload template SendMock ships, with the events it fits and the variables it needs.
---

> Generated from SendMock's code, so it always matches the binary.

Pick one on a webhook endpoint to send events in that service's format, signed as the service signs them. Required variables (such as a signing secret) are set in [Webhooks > Variables](../webhooks/variables.md). Copy a template to change it; see [Templates](../webhooks/templates.md).

## SendMock

| Template | Name | Events | Required variables |
| --- | --- | --- | --- |
| `native` | Native SendMock JSON | `email.received`, `sms.sent`, `sms.inbound`, `sms.status`, `http.captured`, `payment.succeeded`, `payment.failed`, `payment.refunded`, `checkout.completed` |  |

## Email providers

| Template | Name | Events | Required variables |
| --- | --- | --- | --- |
| `mailgun.routes` | Mailgun: routes (inbound) | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` | `mailgun_signing_key` |
| `mailgun.events` | Mailgun: event webhooks | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` | `mailgun_signing_key` |
| `postmark.webhooks` | Postmark: delivery, bounce, spam and open webhooks | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` |  |
| `brevo.events` | Brevo: transactional webhooks | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` |  |
| `sendgrid.inbound_parse` | SendGrid: Inbound Parse | `email.received` |  |
| `sendgrid.events` | SendGrid: Event Webhook | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` |  |
| `postmark.inbound` | Postmark: inbound | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` |  |
| `ses.sns` | Amazon SES via SNS | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` |  |
| `resend.events` | Resend: webhook events | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` | `resend_signing_secret` |
| `sparkpost.events` | SparkPost: event webhooks | `email.received`, `email.opened`, `email.clicked`, `email.delivered`, `email.bounced`, `email.complained` |  |

## SMS providers

| Template | Name | Events | Required variables |
| --- | --- | --- | --- |
| `twilio.inbound_sms` | Twilio: inbound SMS | `sms.inbound` | `twilio_auth_token` |
| `twilio.status_callback` | Twilio: status callback | `sms.status`, `sms.opened` | `twilio_auth_token` |
| `vonage.inbound` | Vonage: inbound SMS | `sms.inbound` |  |
| `vonage.dlr` | Vonage: delivery receipt | `sms.status` |  |
| `plivo.inbound` | Plivo: inbound message | `sms.inbound`, `sms.status` |  |
| `telnyx.message` | Telnyx: message events | `sms.inbound`, `sms.status` |  |
| `whatsapp.cloud` | WhatsApp Cloud: messages and statuses | `sms.inbound`, `sms.status` | `whatsapp_cloud_app_secret` |
| `africastalking.sms` | Africa's Talking: SMS notifications | `sms.inbound`, `sms.status` |  |
| `sinch.sms` | Sinch: delivery reports and inbound SMS | `sms.inbound`, `sms.status` |  |
| `infobip.dlr` | Infobip: delivery reports | `sms.status` |  |

## Payment providers

| Template | Name | Events | Required variables |
| --- | --- | --- | --- |
| `stripe.event` | Stripe: webhook event | `payment.created`, `payment.authorized`, `payment.succeeded`, `payment.failed`, `payment.canceled`, `payment.refunded`, `payment.partially_refunded`, `payment.dispute_opened`, `payment.dispute_updated`, `payment.dispute_closed`, `checkout.completed`, `checkout.expired` | `stripe_webhook_secret` |
| `paypal.webhook` | PayPal: webhook event | `payment.authorized`, `payment.succeeded`, `payment.failed`, `payment.canceled`, `payment.refunded`, `payment.partially_refunded`, `payment.dispute_opened`, `payment.dispute_updated`, `payment.dispute_closed`, `checkout.completed`, `checkout.expired` |  |
| `paypal.ipn` | PayPal: IPN | `payment.succeeded`, `payment.failed`, `payment.canceled`, `payment.refunded`, `payment.partially_refunded`, `payment.dispute_opened`, `payment.dispute_updated`, `payment.dispute_closed` |  |
| `sslcommerz.ipn` | SSLCommerz: IPN | `payment.succeeded`, `payment.failed`, `payment.canceled`, `checkout.expired` | `sslcommerz_store_password` |
| `bkash.callback` | bKash: callback | `payment.succeeded`, `payment.failed`, `payment.canceled` |  |
| `razorpay.webhook` | Razorpay: webhook | `payment.authorized`, `payment.succeeded`, `payment.failed`, `payment.refunded`, `payment.partially_refunded`, `payment.dispute_opened`, `payment.dispute_updated`, `payment.dispute_closed`, `checkout.completed` | `razorpay_webhook_secret` |
| `paddle.webhook` | Paddle: webhook | `payment.created`, `payment.authorized`, `payment.succeeded`, `payment.failed`, `payment.canceled`, `payment.refunded`, `payment.partially_refunded`, `checkout.completed` | `paddle_webhook_secret` |

## Chat apps

| Template | Name | Events | Required variables |
| --- | --- | --- | --- |
| `slack.incoming_webhook` | Slack: incoming webhook | `email.received`, `email.bounced`, `sms.inbound`, `webhook.failed` |  |
| `discord.webhook` | Discord: webhook embed | `email.received`, `sms.inbound`, `webhook.failed` |  |
| `teams.adaptive_card` | Microsoft Teams: Adaptive Card | `email.received`, `webhook.failed` |  |
| `telegram.send_message` | Telegram: bot message | `email.received`, `sms.inbound` | `telegram_bot_token`, `telegram_chat_id` |
| `google_chat.message` | Google Chat: incoming webhook | `email.received`, `email.bounced`, `sms.inbound`, `webhook.failed` |  |

## Automation

| Template | Name | Events | Required variables |
| --- | --- | --- | --- |
| `n8n.flat_json` | n8n / Zapier / Make: flat JSON | `email.received`, `sms.sent`, `sms.inbound` |  |
