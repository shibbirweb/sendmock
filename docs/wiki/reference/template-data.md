---
title: Template data
description: Every field a webhook template reads as data for email and SMS events, listed from real events.
---

> Generated from SendMock's code, so it always matches the binary.

Besides `data`, a template reads `event` (`id`, `type`, `created_at`), `vars`, `endpoint`, `delivery`, `rule`, `sendmock` and `request_id`; see [Templates](../advanced/templates.md). This list comes from real events run through the code a delivery uses: an email with a copy, a header, a tag and an attachment that then bounced, and an SMS your app received. A field that is null here holds a value when the message has one.

## Email events

`email.*` events read the stored email in full, also as `email`.

| Field | Type |
| --- | --- |
| `data` | object |
| `data.attachment_count` | number |
| `data.attachments` | list |
| `data.attachments[]` | object |
| `data.attachments[].content_base64` | text |
| `data.attachments[].content_id` | null in this sample |
| `data.attachments[].content_type` | text |
| `data.attachments[].filename` | text |
| `data.attachments[].index` | number |
| `data.attachments[].size_bytes` | number |
| `data.attachments[].url` | text |
| `data.bounce` | object |
| `data.bounce.code` | number |
| `data.bounce.enhanced_code` | text |
| `data.bounce.message` | text |
| `data.bounce.severity` | text |
| `data.bounce.type` | text |
| `data.bounce_type` | text |
| `data.cc` | list |
| `data.cc[]` | object |
| `data.cc[].address` | text |
| `data.cc[].name` | text |
| `data.content_id_map` | object |
| `data.delivery_status` | text |
| `data.diagnostic` | text |
| `data.direction` | text |
| `data.from` | object |
| `data.from.address` | text |
| `data.from.name` | text |
| `data.has_otp` | true or false |
| `data.header_pairs` | list |
| `data.header_pairs[]` | list |
| `data.header_pairs[][]` | text |
| `data.headers` | object |
| `data.headers.Cc` | list |
| `data.headers.Cc[]` | text |
| `data.headers.Content-Type` | list |
| `data.headers.Content-Type[]` | text |
| `data.headers.Date` | list |
| `data.headers.Date[]` | text |
| `data.headers.From` | list |
| `data.headers.From[]` | text |
| `data.headers.MIME-Version` | list |
| `data.headers.MIME-Version[]` | text |
| `data.headers.Message-ID` | list |
| `data.headers.Message-ID[]` | text |
| `data.headers.Subject` | list |
| `data.headers.Subject[]` | text |
| `data.headers.To` | list |
| `data.headers.To[]` | text |
| `data.headers.X-Order-Id` | list |
| `data.headers.X-Order-Id[]` | text |
| `data.html_body` | text |
| `data.id` | text |
| `data.in_reply_to` | text |
| `data.is_read` | true or false |
| `data.message_id` | text |
| `data.message_url` | text |
| `data.open_count` | number |
| `data.project` | text |
| `data.provider_message_id` | null in this sample |
| `data.received_at` | text |
| `data.references` | text |
| `data.response_kind` | null in this sample |
| `data.size_bytes` | number |
| `data.smtp_code` | text |
| `data.snippet` | text |
| `data.source` | text |
| `data.stripped_signature` | text |
| `data.stripped_text` | text |
| `data.subject` | text |
| `data.tags` | list |
| `data.tags[]` | text |
| `data.template_id` | null in this sample |
| `data.text_body` | text |
| `data.to` | list |
| `data.to[]` | object |
| `data.to[].address` | text |
| `data.to[].name` | text |
| `data.user_variables` | object |

## SMS events

`sms.*` events read the message, with each number's country.

| Field | Type |
| --- | --- |
| `data` | object |
| `data.account` | null in this sample |
| `data.api` | text |
| `data.body` | text |
| `data.channel` | text |
| `data.created_at` | text |
| `data.direction` | text |
| `data.encoding` | text |
| `data.error_code` | null in this sample |
| `data.extracted` | object |
| `data.extracted.links` | list |
| `data.extracted.otp` | list |
| `data.extracted.otp[]` | text |
| `data.from_country` | text |
| `data.from_number` | text |
| `data.id` | text |
| `data.in_reply_to_sms_id` | null in this sample |
| `data.is_read` | true or false |
| `data.media` | list |
| `data.messaging_service_sid` | null in this sample |
| `data.open_count` | number |
| `data.opened_at` | null in this sample |
| `data.project` | text |
| `data.provider_id` | text |
| `data.reply_webhook` | null in this sample |
| `data.segments` | number |
| `data.status` | text |
| `data.status_callback_url` | null in this sample |
| `data.to_country` | text |
| `data.to_number` | text |
| `data.updated_at` | text |
