---
title: Seed file
description: Keep your SendMock setup in your repository. Export, commit, validate, apply, reset before tests, and keep secrets out.
---

> Works in your install from Phase 0 (loading), growing with each phase until Phase 3 covers every item. Try it in the [demo](/demo/settings?section=seed) today.

`sendmock.seed.toml` is the configuration SendMock starts from and resets to. Commit it next to your app's code, and everyone (teammates, CI, an AI agent) gets the same endpoints, rules, templates, variables, numbers, Messaging Services, Verify services, outcome rules, bins, saved deliveries, payment setup and settings.

## Export what you built

1. Build your setup in the UI.
2. In **Settings > Seed**, press **Export sendmock.seed.toml**. The card also lists what changed since the seed was applied.
3. Commit the file.

## Load it

SendMock loads `--seed <file>`, or `./sendmock.seed.toml` in the folder it starts in, or `/config/sendmock.seed.toml` in Docker. Items are matched by name or SID, so restarting with the same file changes nothing.

## Apply a changed file

In **Settings > Seed**, **Apply a seed file**: upload or paste it, press **Validate** (errors come with line numbers, and a summary lists what would change), then apply and confirm. Or `sendmock seed validate` and `sendmock seed apply`.

## Reset before every test run

**Reset to seed** deletes all traffic (emails, SMS, deliveries, payments) and restores the file's configuration:

```bash
sendmock reset --yes
# or
curl -X POST http://127.0.0.1:8025/api/v1/reset
```

## Secrets

Secrets are never written in plain text. Export writes references, which are read from the environment when the file is loaded:

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

[[email.outcome_rules]]
pattern = "*@bounce.qa.test"
outcome = "hard_bounce"
enabled = true
```

## Related

- [Recipe: share your setup](../recipes/share-your-setup.md)
- [Configuration and seed file](../configuration.md)
