---
title: Built-in prompts
description: The ready-made MCP prompts SendMock offers your agent, and when to use each.
---

> Arrives in Phase 4 with the agent skill. See [AI](./index.md) to set up.

Agents that support MCP prompts show these in their prompt picker (in Claude Code, type `/` and look for the `sendmock` entries). Each one runs a whole workflow; the agent skill teaches the same workflows to agents without prompt support.

| Prompt | Use it to |
| --- | --- |
| `setup-email-capture` | find your app's mail settings in the repository, point them at SendMock and send a test email |
| `setup-sms-capture` | find your app's SMS code, switch it to SendMock (native or provider-compatible) and send a test |
| `setup-inbound-webhook` | pick a provider template, create the endpoint and rule, simulate a message and check the delivery |
| `test-otp-flow` | trigger your app's OTP flow, wait for the email or SMS, and return the code |
| `simulate-sms-conversation` | run a scripted two-way SMS exchange against your app's inbound handler |
| `debug-failed-webhook` | read the latest failed delivery, explain the error, suggest a fix and replay |
| `add-payment-flow` | compose a checkout flow step by step from a provider's docs, attach it to a method and run a test checkout |
| `add-payment-gateway` | add a gateway (and its method and flow when needed) from the provider's docs, preview it, run a test checkout and confirm your app gets the redirect and notification |

## Related

- [Build it with AI](./build-with-ai.md)
- [Create a gateway with AI](./payment-gateway-with-ai.md)
