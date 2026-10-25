---
title: Verify
description: Twilio Verify emulation with codes you can read and outcomes you can force.
---

> **The screen is in the [live demo](/demo/sms/verify). The Verify API arrives in Phase 2.**

Your app starts verifications through Twilio Verify's real API. **SMS > Verify** lists each one with its code, channel, attempts and expiry, so a test can read the code instead of waiting for a phone.

- **Services** set the code length, a fixed code for automated tests and the lifetime.
- **Force** an outcome on any verification: approved, expired, canceled or max attempts.
- The latest code for a recipient is also available from the CLI and MCP (`sendmock otp`), in Phase 2.
