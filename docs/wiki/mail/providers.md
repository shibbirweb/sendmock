---
title: Providers
description: The email APIs SendMock answers like the real provider. Change a built-in, remove the ones you do not use, or add your own.
---

> Try it in the [demo](/demo/mail/providers).

An email provider is one API SendMock answers like the real one: SendGrid, Mailgun, Postmark, Resend, Amazon SES, Brevo, or one you add. Providers are data, not code, like [payment gateways](../payments/gateways.md): the requests a provider answers, how SendMock reads them and what it answers are all editable, and **Reset to default** brings a built-in back. The full list is on [Supported providers](../providers.md).

![The email Providers screen](../images/mail-providers.jpg)

## What it solves

- **An email API SendMock does not ship.** Add it from blank or from the closest built-in, with its own paths, fields and answers. See [Advanced: create an email provider](../advanced/email-provider.md).
- **A built-in that differs from your account:** another API version, an extra required field, a message id your app checks.
- **Providers you do not use** clutter the filters and Settings > Connection; remove them, and restore them any time.

## How it connects

| Gets from | Sends to |
| --- | --- |
| your app's API calls at the provider's real path on port `8026`, or at `/providers/<key>/...` | [Mail](./index.md): every send is stored with its provider, shown as a badge that opens this screen |
| [Webhooks > Templates](../webhooks/templates.md): the template its delivery callbacks use | your app: the provider's own answer, success or error |
| its credentials, when **Check credentials** is on | [Settings > Connection](../settings.md#connection): the base URL of every enabled provider |

## Use it

1. Press **Edit SendGrid**.
2. Open **Preview**: the sample send is stored with `ana@example.test` as recipient, and SendGrid answers `202`.
3. Clear the sample body to `{}`: nothing is stored, and the answer is SendGrid's own `400` error.

## Point your provider's SDK at SendMock

Each official SDK has a setting for the address it calls. Point it at the provider port, `http://127.0.0.1:8026`, and keep your code as it is. CI sends with every one of these SDKs on each change (`examples/email-providers/node/`).

| SDK | Setting |
| --- | --- |
| SendGrid (`@sendgrid/mail`) | `sgMail.setClient(client)` and `sgMail.setApiKey(key)`, then `client.setDefaultRequest("baseUrl", "http://127.0.0.1:8026")` on `@sendgrid/client` (after the key, which resets it) |
| Mailgun (`mailgun.js`) | `url: "http://127.0.0.1:8026"` in `mailgun.client({...})` |
| Postmark (`postmark`) | `new ServerClient(token, { useHttps: false, requestHost: "127.0.0.1:8026" })` |
| Resend (`resend`) | `new Resend(key, { baseUrl: "http://127.0.0.1:8026" })` |
| Amazon SES v2 (`@aws-sdk/client-sesv2`) | `endpoint: "http://127.0.0.1:8026"` in `new SESv2Client({...})` |
| Brevo (`@getbrevo/brevo`) | `baseUrl: "http://127.0.0.1:8026/v3"` in `new BrevoClient({...})` |

Any API key works unless **Check credentials** is on for the provider.

Mailgun's send is served at both of its paths: `/v3/{domain}/messages` (fields, as `mailgun.js` and Symfony's `mailgun+api` transport send) and `/v3/{domain}/messages.mime` (the whole MIME message in a `message` file, as Symfony's default `mailgun+https` transport and so Laravel's `mailgun` mailer send). For the MIME path the sender, subject and bodies come from the message and the recipients from `to`.

## Everything on this screen

### The table

Name with its accent dot, Built-in or Custom, **Modified** once a built-in is edited, the key, messages in the last 24 hours, and an enabled switch. The row menu has **Reset to default** (a modified built-in), **Remove** (a built-in) and **Delete** (a custom provider), each asking first. **Add provider** asks for a name, a key and **Start from** (blank, or a copy of another provider).

### Removed

Built-ins you removed are listed here. Requests to their paths get a 404 until you press **Restore**; their messages stay.

### The provider sheet

| Tab | Holds |
| --- | --- |
| **General** | name, key (fixed after creation), host (tells apart providers that share a path), accent, enabled, credentials (secrets masked, reveal asks first) and **Check credentials** |
| **Complaints** | Mailgun only: each sending domain's complaints table, with **Clear** per domain |
| **Requests** | the requests it answers (kind, method, path with `{name}` parts, format), the **field mapping** (where to, from, subject, text, html and the rest are read from) and the **checks** on a send |
| **Responses** | the message id template, the success response and one response per error kind (missing field, invalid value, unauthorized, not found, rate limited) |
| **Callbacks** | the webhook template for its delivery callbacks and the provider's name for each status |
| **Preview** | a sample request, the message SendMock would store, the answer it would give, the problems, and what templates can read |
| **Try it** | the base URLs and a `curl` command for this provider |

A provider with template errors cannot be saved, and a path that another enabled provider answers is refused with its name.


Every control and text, one by one: [Email providers in depth](../deeper/mail/providers.md).
## Mailgun events and complaints

The provider port answers Mailgun's events and complaints APIs for each sending domain (the `{domain}` of `/v3/{domain}/messages`):

| Path | What it does |
| --- | --- |
| `GET /v3/{domain}/events` | the domain's events: `accepted` for each recipient, then `delivered`, `failed` (with `severity` and `delivery-status`), `opened`, `clicked` and `complained` as the email's outcome plays, with the same data the `mailgun.events` template sends. Filters: `event` (also `delivered OR failed`), `recipient`, `message-id`, `from`, `to`, `subject`, `tags`, `severity`, `begin`, `end`, `ascending` and `limit` (up to 300); the `paging` URLs answer the next and previous pages |
| `GET`, `POST`, `DELETE /v3/{domain}/complaints` | lists the domain's complaints, adds one (`address`) and clears them all |
| `GET`, `DELETE /v3/{domain}/complaints/{address}` | reads and removes one; an address without a complaint answers `404` |

A complaint made in SendMock (Simulate, the `complaint@` address or an outcome rule) about an email sent through Mailgun puts the address on that domain's table. A later Mailgun send to it is accepted but not delivered: it is recorded as a `failed` event with reason `suppress-complaint`, as Mailgun does. The **Complaints** tab on Mail > Providers > Mailgun lists every domain's table and clears it.

## Mailgun templates, variables and message ids

- **Template sends:** a send with `template` (and `t:variables`) needs no `text` or `html`, as on Mailgun. The email keeps the template's name and data, shown on its **Template** tab; a local email template with the same name gives it a subject and bodies.
- **User variables:** `v:` fields (`v:order-id=A-1001`) and the `X-Mailgun-Variables` header, as a form field or inside a `/messages.mime` message, are kept with the email as its user variables. The email API shows them as `user_variables`, and webhook templates read them as `data.user_variables`.
- **Message ids:** the id the send answers (`<...@your-domain>`) is kept with the email as `provider_message_id`, shown by the email API and read by templates as `data.provider_message_id`. The built-in `mailgun.events` template sends it as `message-id`, without the angle brackets as Mailgun does, so your app can match the webhook to the send. `data.message_id` stays the email's own `Message-Id` header.
- **Addresses in paths:** an address in a path can be percent-encoded (`/complaints/user%40example.org`), as Mailgun's SDKs send it.

## Customize

The full walkthrough, from the provider's API docs to a working provider: [Advanced: create an email provider](../advanced/email-provider.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| list | [`sendmock email providers list`](/cli/email-providers/#email-providers-list) | [`GET /api/v1/emails/providers`](/api/email-providers/#getEmailsProviders) | [`sendmock_email_provider_list`](/mcp/email-providers/#sendmock_email_provider_list) |
| one provider | [`sendmock email providers show <providerKey>`](/cli/email-providers/#email-providers-show) | [`GET /api/v1/emails/providers/{providerKey}`](/api/email-providers/#getEmailsProvidersByProviderKey) | [`sendmock_email_provider_get`](/mcp/email-providers/#sendmock_email_provider_get) |
| add | [`sendmock email providers create`](/cli/email-providers/#email-providers-create) | [`POST /api/v1/emails/providers`](/api/email-providers/#postEmailsProviders) | [`sendmock_email_provider_create`](/mcp/email-providers/#sendmock_email_provider_create) |
| change | [`sendmock email providers update <providerKey>`](/cli/email-providers/#email-providers-update) | [`PATCH /api/v1/emails/providers/{providerKey}`](/api/email-providers/#patchEmailsProvidersByProviderKey) | [`sendmock_email_provider_update`](/mcp/email-providers/#sendmock_email_provider_update) |
| preview | [`sendmock email providers preview <providerKey>`](/cli/email-providers/#email-providers-preview) | [`POST /api/v1/emails/providers/{providerKey}/preview`](/api/email-providers/#postEmailsProvidersByProviderKeyPreview) | [`sendmock_email_provider_preview`](/mcp/email-providers/#sendmock_email_provider_preview) |
| reset a built-in | [`sendmock email providers reset <providerKey>`](/cli/email-providers/#email-providers-reset) | [`POST /api/v1/emails/providers/{providerKey}/reset`](/api/email-providers/#postEmailsProvidersByProviderKeyReset) | [`sendmock_email_provider_reset`](/mcp/email-providers/#sendmock_email_provider_reset) |
| remove a built-in or delete a custom one | [`sendmock email providers delete <providerKey>`](/cli/email-providers/#email-providers-delete) | [`DELETE /api/v1/emails/providers/{providerKey}`](/api/email-providers/#deleteEmailsProvidersByProviderKey) | [`sendmock_email_provider_delete`](/mcp/email-providers/#sendmock_email_provider_delete) |
| restore a removed built-in | [`sendmock email providers restore <providerKey>`](/cli/email-providers/#email-providers-restore) | [`POST /api/v1/emails/providers/{providerKey}/restore`](/api/email-providers/#postEmailsProvidersByProviderKeyRestore) | [`sendmock_email_provider_restore`](/mcp/email-providers/#sendmock_email_provider_restore) |
| reveal a credential (agents cannot) | [`sendmock email providers credential <providerKey> <credentialName> --reveal`](/cli/email-providers/#email-providers-credential) | [`GET /api/v1/emails/providers/{providerKey}/credentials/{credentialName}`](/api/email-providers/#getEmailsProvidersByProviderKeyCredentialsByCredentialName) | none: agents never read secrets |
| list Mailgun complaints | [`sendmock email mailgun complaints list`](/cli/email/#email-mailgun-complaints-list) | [`GET /api/v1/mailgun/complaints`](/api/email/#getMailgunComplaints) | [`sendmock_email_mailgun_complaint_list`](/mcp/email/#sendmock_email_mailgun_complaint_list) |
| clear a domain's complaints | [`sendmock email mailgun complaints clear <domain>`](/cli/email/#email-mailgun-complaints-clear) | [`DELETE /api/v1/mailgun/complaints/{domain}`](/api/email/#deleteMailgunComplaintsByDomain) | [`sendmock_email_mailgun_complaint_clear`](/mcp/email/#sendmock_email_mailgun_complaint_clear) |

## Related

- [Supported providers](../providers.md)
- [SMS providers](../sms/providers.md)
- [Gateways](../payments/gateways.md)
