---
title: Connect your app
description: Point your app's mail, SMS and payment settings at SendMock.
---

> **Applies from the first beta (Phase 1).** The demo's Settings > Connection shows the same snippets for each language.

SendMock speaks the protocols your app already uses, so connecting is a settings change, not a code change:

| What | Point it at |
| --- | --- |
| Email over SMTP | host `127.0.0.1`, port `1025`, no TLS, any username and password |
| Email or SMS provider SDKs | the provider port `http://127.0.0.1:8026` as the SDK's base URL ([email](../mail/index.md), [SMS](../sms/index.md)) |
| SendMock's own API | `http://127.0.0.1:8025/api/v1` ([API reference](/api/)) |
| Your webhooks | an endpoint in **Webhooks** pointing at your app ([webhooks](../webhooks/index.md)) |

From inside Docker, use `host.docker.internal` (or the Compose service name) instead of `127.0.0.1`.

Pick your language:

- [PHP and Laravel](./php.md)
- [Node.js](./node.md)
- [Python](./python.md)
- [Go](./go.md)
- [Java](./java.md)
- [Rust](./rust.md)
- [Ruby](./ruby.md)
- [.NET](./dotnet.md)
