---
title: Seed file
description: Keep your SendMock setup in your repository. Export, commit, validate, apply, reset before tests, and keep secrets out.
---

> In your install today: settings, webhook endpoints, rules, templates, variables and saved deliveries, Verify services, Messaging Services, numbers, custom outcome numbers and addresses, edited or removed SMS providers, and payment flows, methods and gateways (custom ones and edited built-ins) are applied, exported and restored. HTTP bins, tag and forward rules, email providers and custom SMS providers come with their features; until then those sections are checked and skipped with a warning. Try the full flow in the [demo](/demo/settings?section=seed).

`sendmock.seed.toml` is the configuration SendMock starts from and resets to. Commit it next to your app's code, and everyone (teammates, CI, an AI agent) gets the same endpoints, rules, templates, variables, numbers, Messaging Services, Verify services, outcome rules, bins, saved deliveries, payment setup and settings.

## Export what you built

1. Build your setup in the UI.
2. In **Settings > Seed**, press **Export sendmock.seed.toml**. The card also lists what changed since the seed was applied.
3. Commit the file.

## Load it

SendMock loads `--seed <file>`, or `./sendmock.seed.toml` in the folder it starts in, or `/config/sendmock.seed.toml` in Docker, before it answers its first request. Items are matched by SID, number or pattern, so restarting with the same file changes nothing. Items the file creates are marked as made by the seed. A file with an error, or an item SendMock refuses (a number that is not E.164, for example), stops startup with the reason.

Command-line flags and `SENDMOCK_*` environment variables still win over the file's `[settings]`.

Endpoints are matched by name; rules, variables and saved deliveries refer to their endpoint by that name. Templates are matched by their id (`custom.<name>`, or a built-in's id for an edited built-in) and use the template file format from **Webhooks > Templates > Export**.

## Apply a changed file

In **Settings > Seed**, **Apply a seed file**: upload or paste it, press **Validate** (errors come with line numbers, and a summary lists what would change), then apply and confirm. Or `sendmock seed validate` and `sendmock seed apply`.

## Reset before every test run

**Reset to seed** deletes all traffic (emails, SMS, deliveries, payments), puts the settings back to their defaults and restores the seed applied last: items you edited get the file's values again, and items the file does not hold are deleted (saved deliveries are kept, as they are without a seed). Without a seed, reset keeps your configuration.

```bash
sendmock reset --yes
# or
curl -X POST http://127.0.0.1:8025/api/v1/reset
```

## Secrets

Secrets are never written in plain text: endpoint secrets, secret variables and secret provider credentials are exported as references, which are read from the environment when the file is loaded. A variable that is not set reads as empty: an endpoint then keeps or generates its secret, and an item that needs the value is refused with the variable named, so set it and apply again. The relay SMTP URL is never exported, as it holds a password. Any string can use a reference, such as a URL with `http://${APP_HOST}/sms/inbound`:

```toml
[[webhook.endpoints]]
name = "Laravel inbound mail"
url = "http://localhost:8000/webhooks/mail"
template = "postmark.inbound"
secret = "${LARAVEL_INBOUND_MAIL_SECRET}"
```

## What a seed file looks like

```toml
[settings]
sms_simulation_profile = "realistic"
email_outcome_profile = "off"

[[verify.services]]
sid = "VA00000000000000000000000000000001"
name = "Login"
code_length = 6
fixed_code = "123456"
ttl_seconds = 600

[[messaging_services]]
sid = "MG00000000000000000000000000000001"
name = "Notifications"
inbound_mode = "defer_to_sender"

[[numbers]]
number = "+15550001111"
label = "Support line"
channels = ["sms", "whatsapp"]
inbound_url = "http://localhost:8000/sms/inbound"
inbound_method = "POST"
inbound_template = "twilio.inbound_sms"
messaging_service = "MG00000000000000000000000000000001"

[[sms.outcome_rules]]
match = "to"
pattern = "+1555777*"
outcome = "undelivered"
error_code = "30003"

[[email.outcome_rules]]
pattern = "*@bounce.qa.test"
outcome = "hard_bounce"
enabled = true
```

`[settings]` takes the same keys as **Settings** and `PATCH /api/v1/settings`. Export writes only the settings you changed from the defaults.

## Projects

Projects keep apps' traffic apart in one SendMock ([Settings: Projects](../settings.md#projects)). The seed file lists every project but `default`, which always exists:

```toml
[[projects]]
key = "shop"
name = "Shop"
```

Applying adds a project or renames the one with the same key. A reset keeps the projects you made when no seed file was applied, and restores exactly the seed's projects when one was.

## Email templates

Apps that send through SendGrid dynamic templates, Postmark templates or Brevo templates only send a template id and its data; the provider holds the template. SendMock keeps the id and the data on the email (the **Template data** tab). To also see the email the provider would have sent, give SendMock a local stand-in under the same id:

```toml
[[email.templates]]
id = "d-4f1c2b9a7e6d"
subject = "Welcome, {{ first_name }}"
text = "Hi {{ first_name }}, your {{ plan }} plan is ready."
html = "<p>Hi {{ first_name }}, your <b>{{ plan }}</b> plan is ready.</p>"
```

A template send whose id matches is stored with this subject (unless the send names its own) and these bodies, rendered from the send's template data with the same template language as webhook templates. A template needs a `text` or an `html` body.

## Payment flows, methods and gateways

Custom payment flows, methods and gateways, and the built-ins you edited, are exported under `[[payments.flows]]`, `[[payments.methods]]` and `[[payments.gateways]]`. Each item names its `key` and holds its `definition` as JSON, the same fields the API takes. A gateway names its notification endpoint by name, and its secret credentials are exported as references:

```toml
[[payments.gateways]]
key = "upay_gateway"
name = "Upay"
edits_builtin = false
notification_endpoint = "Shop payments"
definition = '{"name":"Upay","accent":"#0a7cff","is_enabled":true,"method_keys":["upay"],"credentials":[{"name":"api_secret","value":"${UPAY_GATEWAY_API_SECRET_SECRET}","is_secret":true}], ...}'
```

Flows are applied before the methods that run them, and methods before the gateways that offer them. A built-in you did not edit is not exported; a reset puts any built-in the file does not hold back as shipped and deletes custom ones it does not hold, unless a payment or another definition still uses them.

## Related

- [Recipe: share your setup](../recipes/share-your-setup.md)
- [Configuration and seed file](../configuration.md)
