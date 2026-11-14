---
description: Sets up a webhook endpoint and rule so the app receives inbound SMS in Twilio's format.
max_turns: 25
timeout_seconds: 600
allowed_tools: [Skill]
---

When a customer texts our support line, my app should get Twilio's incoming SMS webhook at http://127.0.0.1:4000/sms/inbound. SendMock is running. Set that up in SendMock for me.
