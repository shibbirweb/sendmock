---
title: Templates
description: Payload templates for SendMock's own JSON, the providers your app parses and chat tools.
---

> **The screens are in the [live demo](/demo/webhooks/templates). Rendering on the server arrives in Phase 3.**

A template shapes a webhook request: method, content type, headers and body. Built-in templates cover SendMock's native JSON, email and SMS providers (Twilio, Vonage, Plivo, Telnyx, SendGrid, Mailgun, Postmark, Resend, Amazon SES) and chat tools (Slack, Discord, Microsoft Teams).

- Bodies use Jinja syntax; type `{{` for suggestions, and the reference panel lists every value and filter.
- Edit a built-in template (it shows as modified and can be reset) or create your own, import and export them as TOML.
- Every save keeps a revision you can restore.
