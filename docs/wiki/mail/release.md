---
title: Release
description: Send a real copy of a caught email through your SMTP relay, only to addresses you allow.
---

> Try it in the [demo](/demo/mail). Works in your install from Phase 4.

SendMock never delivers email by itself. Sometimes you do want one real copy: a designer wants the newsletter in their own Outlook, or you want to check a real Gmail inbox. **Release** sends a copy through a real SMTP relay, and only to addresses on your allowlist.

## What it solves

- Seeing an email in a real client without pointing your app at real SMTP.
- Making sure a test can never email a real customer by mistake: release refuses any address not on the allowlist.

## Set it up

1. Open [Settings > Email](../settings.md#email).
2. Under **Release to real SMTP**, fill in **Relay SMTP URL**, for example `smtp://user:password@smtp.example.com:587`. The password is masked after saving.
3. Add the addresses (or `*@yourcompany.com` patterns) allowed to receive released mail to **Allowed recipients**. Release stays off until the list has an entry.
4. Press **Save changes**.

## Release an email

Open the email, choose **Release to real SMTP** from its actions, pick the recipients (only allowed recipients are accepted) and send. The email's **Timeline** records the release, and `email.released` fires for your rules.

## Safe by default

- With no allowlist, nothing can be released.
- Inbound routes that forward to an email address go through the same allowlist.
- The relay password never shows in the UI, API answers, logs or seed exports.

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| release | `sendmock email release <emailId>` | [`POST /api/v1/emails/{emailId}/release`](/api/email/#postEmailsByEmailIdRelease) | `sendmock_email_release` |
| set the relay and allowlist | `sendmock settings set <key> <value>` | [`PATCH /api/v1/settings`](/api/system/#patchSettings) | `sendmock_settings_update` |

## Related

- [Mail](./index.md)
- [Settings > Email](../settings.md#email)
