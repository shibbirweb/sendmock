---
title: Email outcome addresses
description: Your own addresses and patterns that always deliver, bounce, defer, complain, unsubscribe or are rejected.
---

> Works in your install from Phase 3. Try it in the [demo](/demo/settings?section=email) today.

The magic addresses (`bounce@`, `complaint@`, ...) cover the common cases. Your own rules cover the rest: a QA domain where everything bounces, one address that is always rejected, a diagnostic text your app parses.

## When you would

- Your tests use their own domain, for example `*@bounce.qa.test`, and every address on it should hard bounce.
- Your app must handle a recipient refused at send time (`550 5.7.1`), not a bounce afterwards.
- Your bounce parser reads the diagnostic text, so it should match your provider's.

## Steps

1. Open **Settings > Email**, find **Custom outcome addresses** and press **Add address**.
2. **Address or pattern:** an exact address, or `*` wildcards, for example `*@blocked.test`.
3. **Outcome:** Delivered, Hard bounce, Soft bounce (deferred), Spam complaint, Unsubscribe, or Reject the recipient (refused during SMTP `RCPT` and the HTTP send APIs).
4. Optionally an **SMTP code**, **Diagnostic text (optional)** and **Note (optional)**. Press **Add rule**.
5. Type an address in **Test an address**: it says which rule, magic address or profile applies, for example "Custom rule 2: Reject the recipient, 550 5.7.1".

## How rules are applied

Your rules are checked in order, first match wins; then the magic addresses (unless switched off with **Magic addresses**); then the delivery profile. Rows can be moved up and down, switched off without deleting, and deleted.

## In the seed file

```toml
[[email.outcome_rules]]
pattern = "*@bounce.qa.test"
outcome = "hard_bounce"
smtp_code = 550
diagnostic = "5.1.1 user unknown"
enabled = true
```

## With the CLI and API

`sendmock outcome-rule email create` and `sendmock outcome-rule email test <address>`, or `POST /api/v1/outcome-rules/email` with the same fields; MCP `sendmock_outcome_rule_create` and `sendmock_outcome_rule_test`.

## Related

- [Outcomes](../mail/outcomes.md)
- [Recipe: bounces and complaints](../recipes/bounces-and-complaints.md)
