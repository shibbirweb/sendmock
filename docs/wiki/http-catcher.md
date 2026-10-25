---
title: HTTP catcher
description: A bin for any HTTP call your app makes, answered the way you choose.
---

> **The screen is in the [live demo](/demo/http). The catch URLs arrive in Phase 4.**

Point any outgoing HTTP call at `http://127.0.0.1:8025/catch/<bin>/...` and SendMock records it: method, path, query, headers, body and uploaded files. Slack, Discord and push notification requests are previewed the way they would appear.

- **Responses:** each bin answers with a default response, or with the first matching rule (method, path pattern, filters), including delays and a failure rate.
- **Forward** sends a captured request on to another URL.
