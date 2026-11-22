---
title: Templates
description: Local stand-ins for your provider's email templates, so template sends store the email the provider would have sent.
---

> Try it in the [demo](/demo/mail/templates).

Apps that send through SendGrid dynamic templates, Postmark templates, Brevo templates or Mailgun templates send only a template id or name and its data; the provider holds the template. **Mail > Templates** keeps a local stand-in under the same id, so a template send is stored with the subject and bodies the provider would have sent, rendered from the send's template data with the same template language as [webhook templates](../webhooks/templates.md).

## Use it

1. Open **Mail > Templates** and press **New template**.
2. Enter the template's id or name exactly as your app sends it: SendGrid's `d-...`, Postmark's number or alias, Mailgun's template name.
3. Write a subject and a text body, an HTML body or both. They read the send's template data, such as `{{ first_name }}`.
4. Press **Save**. The next send that names the template is stored with this subject (unless the send names its own) and these bodies.

Click a template to change its subject or bodies, or to delete it. Emails already stored keep the bodies they were sent with.

## Mailgun's template API

The provider port answers `GET /v3/{domain}/templates/{name}` from these templates in Mailgun's shape, with the template's text or HTML as its active version (also with `active=yes`); a name without a template answers `404` as Mailgun does. Apps that look a template up before sending it work unchanged.

## In the seed and setup files

The same templates are the `[[email.templates]]` section of the [seed and setup files](../advanced/seed-file.md):

```toml
[[email.templates]]
id = "welcome-email"
subject = "Welcome, {{ first_name }}"
text = "Hi {{ first_name }}, thanks for joining."
html = "<p>Hi {{ first_name }}, thanks for joining.</p>"
```

| Key | Required | What it holds |
| --- | --- | --- |
| `id` | yes | the provider's template id or name, as your app sends it |
| `subject` | no | the subject, used when the send gives none; reads the template data |
| `text` | `text` or `html` | the plain-text body |
| `html` | `text` or `html` | the HTML body |

Any other key, such as `template_id` or `name`, is refused by `sendmock setup validate` and by the import, with the key named, so a typo never imports as an empty template.

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| list the templates | [`sendmock email templates list`](/cli/email-templates/#email-templates-list) | [`GET /api/v1/emails/templates`](/api/email-templates/#getEmailsTemplates) | [`sendmock_email_template_list`](/mcp/email-templates/#sendmock_email_template_list) |
| add one | [`sendmock email templates create`](/cli/email-templates/#email-templates-create) | [`POST /api/v1/emails/templates`](/api/email-templates/#postEmailsTemplates) | [`sendmock_email_template_create`](/mcp/email-templates/#sendmock_email_template_create) |
| change one | [`sendmock email templates update <templateId>`](/cli/email-templates/#email-templates-update) | [`PATCH /api/v1/emails/templates/{templateId}`](/api/email-templates/#patchEmailsTemplatesByTemplateId) | [`sendmock_email_template_update`](/mcp/email-templates/#sendmock_email_template_update) |
| delete one | [`sendmock email templates delete <templateId>`](/cli/email-templates/#email-templates-delete) | [`DELETE /api/v1/emails/templates/{templateId}`](/api/email-templates/#deleteEmailsTemplatesByTemplateId) | [`sendmock_email_template_delete`](/mcp/email-templates/#sendmock_email_template_delete) |

## Related

- [Providers](./providers.md): the email APIs whose template sends use these templates.
- [Seed file](../advanced/seed-file.md): keep the templates in your repository.
