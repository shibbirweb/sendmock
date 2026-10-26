---
title: OTP patterns
description: Teach SendMock your app's code format, so codes are extracted from every email and SMS.
---

> Works in your install from Phase 1. Try it in the [demo](/demo/settings?section=otp) today.

SendMock finds one-time codes with regular expressions. The defaults catch the usual "Your code is 482913". If your app writes codes another way (`ABC-123`, a code in a link, an 8-letter token), add a pattern.

## Steps

1. Open **Settings > OTP patterns**.
2. Add a pattern. The **first capture group** is the code, for example `Login code: ([A-Z]{3}-\d{3})`.
3. Paste one of your app's messages into **Try a message**: it shows which pattern matched and the code, or "No code found."
4. Order matters: patterns are tried top to bottom on every new email and SMS, and the first match wins. Move yours above the defaults if both match.
5. Press **Save changes**. Invalid patterns are flagged; **Restore defaults** brings back the shipped list.

New messages show the code with a copy button, and `sendmock otp` and the `sendmock_otp_get` MCP tool return it.

## In the seed file

```toml
[settings]
otp_patterns = ["Login code: ([A-Z]{3}-\\d{3})", "\\b(\\d{6})\\b"]
```

## Related

- [Recipe: read a code](../recipes/read-a-code.md)
- [Settings > OTP patterns](../settings.md#otp-patterns)
