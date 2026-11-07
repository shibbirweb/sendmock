---
title: Create and edit templates
description: Edit a built-in template, clone one, write your own, keep revisions, and share templates with your team.
---

> Try it in the [demo](/demo/webhooks/templates).

A template is the shape of a webhook request. When no built-in matches what your app expects, change one or write your own.

## When you would

- A provider SendMock does not ship (an SMS gateway, an email service, an internal system).
- A built-in is right except for one header or field (an `X-Tenant` header your app needs).
- Every endpoint using a provider should send the same changed request.

## Four ways to get a template

| Way | Use when | Steps |
| --- | --- | --- |
| **Edit a built-in** | every endpoint using it should change | open it, press **Edit**, change, **Save template**. It shows **Modified**; **Reset to default** brings back the shipped one |
| **Clone** | you want a separate copy | open it, press **Clone**, give it a **Name**; the copy opens, ready to edit |
| **New template** | nothing is close | press **New template**, give it a name; the editor opens on SendMock's native JSON |
| **Save as template** | an endpoint or saved delivery already sends the right request | on the endpoint's Request tab, or a saved delivery, choose **Save as template** |

## Steps: clone and change

1. Open **Webhooks > Templates**, the **Email providers** tab, and click **Postmark: inbound**.
2. Press **Clone**, name it `Postmark inbound with tenant`, and press **Clone**.
3. The clone opens (the gallery lists it under **Custom**). Press **Edit**, add a header template `X-Tenant` with `{{ vars.tenant_id }}`, and change the body if needed.
4. The preview renders against the built-in sample or a recent message (**Preview with**). Errors (an unknown filter, an unclosed `{{`) block saving; warnings (an empty value) do not.
5. Press **Save template**. Pick it on any endpoint's Request tab.

## What a custom template has

Name, description, the **events** it fits (the gallery and endpoint picker only offer it for those), its **required variables** (endpoints show them as **Missing** until set), method, content type, headers, query and body, and the body mode (Fields, Raw or None). Inside `{{ }}`, suggestions list every value, function and filter; the reference panel explains each.

## Fake data and Postman aliases

Besides the context, variables and `uuid()`, `random_int()` and the other generated values, templates can call fake data:

| Function | Gives |
| --- | --- |
| `fake.name()`, `fake.first_name()`, `fake.last_name()` | a person's name |
| `fake.email()`, `fake.username()`, `fake.company()` | an address at a test domain, a username, a company |
| `fake.address()`, `fake.city()`, `fake.country_code()` | a street address, a city, a two-letter country code |
| `fake.ip()`, `fake.user_agent()`, `fake.url()` | an address from the documentation range, a browser user agent, a URL at a test domain |
| `fake.word()`, `fake.sentence()`, `fake.paragraph()`, `lorem(words)` | placeholder text |

Requests brought over from Postman keep working: `{{$randomUUID}}`, `{{$guid}}`, `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$randomInt}}`, `{{$randomEmail}}`, `{{$randomFirstName}}`, `{{$randomFullName}}`, `{{$randomCompanyName}}`, `{{$randomCity}}`, `{{$randomIP}}`, `{{$randomUrl}}`, `{{$randomLoremSentence}}` and the like become the matching function before rendering.

## Provider signatures

The built-in provider templates sign their requests as the providers do, so your app's check passes unchanged: Twilio's `X-Twilio-Signature`, Mailgun's `signature` block (with your `mailgun_signing_key` variable), Resend's Svix headers (with your `resend_signing_secret`, a `whsec_` key), and Stripe, Razorpay, Paddle and SSLCommerz signatures. SendGrid signs its event webhook with a key pair it keeps; SendMock signs with a published test key pair, so set your app's SendGrid verification key to:

```text
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEdZuCtJsfc9vqpbyG5Cknr4QqZWrFTIOUqVuAy9/FtZ3CdY7v0Xd+IwjfbPzxo6nvA60JYfvGMr5ifaJ0Hd5OAA==
```

## Revisions

Every save of a custom or edited template keeps a revision (the last 20). **History** shows each with a diff against the current version and **Restore** (which saves it as a new revision).

## Linked or detached

Endpoints using a custom template are **Linked** by default and follow its changes. Choose **Detached** on an endpoint to keep a private copy. Deleting a template in use asks to detach those endpoints first.

## Share with your team

- **Export** downloads `<id>.sendmock-template.toml` (variable declarations only, never secret values); **Import a template** loads one, as a replacement or a copy.
- Start SendMock with `--templates-dir ./sendmock-templates` (or `SENDMOCK_TEMPLATES_DIR`) and every `*.toml` in that folder is loaded and watched. Commit the folder to your app's repository. These show a "from file" badge and are read-only in the UI (edit the file, or clone).
- Templates also go into the seed file.

## With the CLI and API

`sendmock webhook template clone <templateId>`, `sendmock webhook template create`, `sendmock webhook template export <templateId>` and `sendmock webhook template import <file>`, or `/api/v1/webhooks/templates`; MCP `sendmock_webhook_template_clone` and the other template tools. Agents can write a template from a provider's docs: "Send Africa's Talking inbound SMS to my app."

## Related

- [Templates](../webhooks/templates.md)
- [Request editor](./request-editor.md)
- [Variables](./variables.md)
