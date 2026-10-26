---
title: Scenarios
description: Write a multi-step test once in TOML and run it again and again, by hand, in CI or from an AI agent.
---

> Arrives in Phase 4. The [playground](/playground/) has a scenario mode you can try today.

A scenario is a list of steps: set things up, trigger your app, wait for the message, check it, simulate what happens next. Each step is a SendMock operation (the same ones as the CLI and MCP tools), plus `http` to call your app, `assert` and `sleep`.

## When you would

- An OTP login, a password reset or a checkout should be checked end to end on every pull request.
- An AI agent built a flow for you and you want to keep it as a test.

## Example: OTP login with status callbacks

```toml
name = "otp-login-and-status"

[[steps]]
run = "webhook.endpoint.create"
with = { name = "app-sms-status", url = "http://localhost:8000/sms/status", template = "twilio.status_callback" }

[[steps]]
run = "webhook.rule.create"
with = { endpoint = "app-sms-status", events = ["sms.status"] }

[[steps]]
run = "http"
with = { method = "POST", url = "http://localhost:8000/login/otp", json = { phone = "+8801700000000" } }

[[steps]]
run = "sms.wait"
with = { to = "+8801700000000", timeout = "10s" }
save = "otp_sms"

[[steps]]
run = "assert"
with = { that = "{{ otp_sms.extracted.otp | length }} > 0" }

[[steps]]
run = "webhook.deliveries.wait"
with = { endpoint = "app-sms-status", status = "succeeded", count = 3, timeout = "15s" }
```

## Run it

```bash
sendmock scenario run otp-login.toml          # a step-by-step report
sendmock scenario run otp-login.toml --json   # for CI and agents
```

Agents use the `sendmock_scenario_run` and `sendmock_scenario_validate` MCP tools.

## Related

- [CLI](../cli.md)
- [AI](../ai/index.md)
