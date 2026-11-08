---
title: Configuration flags
description: Every flag of sendmock serve, with its environment variable, sendmock.toml key and default.
---

> Generated from SendMock's code, so it always matches the binary.

Each setting can come from a flag, a `SENDMOCK_*` environment variable or a key in `sendmock.toml`. A flag wins over the variable, and both win over the file; an unknown key or an invalid value stops SendMock at startup with a message. See [Configuration and seed file](../configuration.md) for how they fit together.

| Flag | Environment variable | `sendmock.toml` key | Default | What it does |
| --- | --- | --- | --- | --- |
| `--config <FILE>` | `SENDMOCK_CONFIG` |  | ./sendmock.toml, then sendmock/sendmock.toml in the OS config folder | Configuration file. |
| `--http-addr <HOST:PORT>` | `SENDMOCK_HTTP_ADDR` | `http_addr` | `127.0.0.1:8025` | Address for the web UI, REST API and MCP. |
| `--smtp-addr <HOST:PORT>` | `SENDMOCK_SMTP_ADDR` | `smtp_addr` | `127.0.0.1:1025` | Address for the SMTP listener. |
| `--smtps-addr <HOST:PORT>` | `SENDMOCK_SMTPS_ADDR` | `smtps_addr` |  | Address for the SMTPS listener (TLS from the first byte); off unless set. |
| `--provider-addr <HOST:PORT>` | `SENDMOCK_PROVIDER_ADDR` | `provider_addr` |  | Address that serves the provider APIs at their real paths, for SDKs with a swapped base URL; off unless set. |
| `--catcher-addr <HOST:PORT>` | `SENDMOCK_CATCHER_ADDR` | `catcher_addr` |  | Address that captures every request at any path in the HTTP catcher, the first path segment naming the bin; off unless set. |
| `--pop3-addr <HOST:PORT>` | `SENDMOCK_POP3_ADDR` | `pop3_addr` |  | Address for the POP3 listener, which serves the captured mail per project; off unless set. |
| `--pop3-auth <MODE>` | `SENDMOCK_POP3_AUTH` | `pop3_auth` | `accept-any` | POP3 login: `accept-any` or `file:<path>` with `user:password` lines; the username picks the project. |
| `--provider-port <PROVIDER=PORT>` | `SENDMOCK_PROVIDER_PORTS` | `provider_ports` |  | Give one provider its own port, as `provider=port` (repeat or separate with commas), for providers that share a path. |
| `--smtp-max-size <SIZE>` | `SENDMOCK_SMTP_MAX_SIZE` | `smtp_max_size` | `25MB` | Largest message SMTP accepts; larger ones get 552. |
| `--smtp-auth <MODE>` | `SENDMOCK_SMTP_AUTH` | `smtp_auth` | `accept-any` | SMTP AUTH: `accept-any`, `none` (not offered) or `file:<path>` with `user:password` lines. |
| `--smtp-tls-cert <FILE>` | `SENDMOCK_SMTP_TLS_CERT` | `smtp_tls_cert` | a self-signed one generated on first run | Certificate (PEM) for STARTTLS and SMTPS. |
| `--smtp-tls-key <FILE>` | `SENDMOCK_SMTP_TLS_KEY` | `smtp_tls_key` |  | Private key (PEM) for `--smtp-tls-cert`. |
| `--smtp-starttls` | `SENDMOCK_SMTP_STARTTLS` | `smtp_starttls` |  | Offer STARTTLS on the SMTP port, with a self-signed certificate generated on first run unless --smtp-tls-cert is set. |
| `--smtp-require-tls` | `SENDMOCK_SMTP_REQUIRE_TLS` | `smtp_require_tls` |  | Refuse MAIL with 530 until the client has run STARTTLS (turns STARTTLS on). |
| `--smtp-allow-rcpt <GLOBS>` | `SENDMOCK_SMTP_ALLOW_RCPT` | `smtp_allow_rcpt` | `*` | Recipients SMTP accepts, as comma-separated globs; others get 550. |
| `--max-emails <COUNT>` | `SENDMOCK_MAX_EMAILS` | `max_emails` | `1000` | The most emails kept; older ones (and older SMTP and API log entries) are pruned. |
| `--max-age <DAYS>` | `SENDMOCK_MAX_AGE` | `max_age` | keep until the count limit | Prune traffic older than this, such as 7d. |
| `--update-check <MODE>` | `SENDMOCK_UPDATE_CHECK` | `update_check` | `off` | When to look for a newer release: off, manual or daily. |
| `--relay-smtp <URL>` | `SENDMOCK_RELAY_SMTP` | `relay_smtp` | `off` | A real SMTP server that Release and auto-forward rules send through, such as smtp://user:password@smtp.example.com:587. |
| `--relay-allowlist <GLOBS>` | `SENDMOCK_RELAY_ALLOWLIST` | `relay_allowlist` | `none` | Recipients Release and auto-forward may send to, as comma-separated globs such as *@yourcompany.com; nothing leaves without one. |
| `--spamassassin <HOST:PORT>` | `SENDMOCK_SPAMASSASSIN` | `spamassassin` | `off` | A running SpamAssassin `spamd` to score emails in the Checks tab. |
| `--ready-json` | `SENDMOCK_READY_JSON` |  |  | Print one JSON line with the bound addresses on stdout once listening (logs go to stderr); port 0 picks a free port. |
| `--demo` | `SENDMOCK_DEMO` |  |  | Fill an empty instance with the website demo's sample data (emails, SMS, webhooks, catcher bins, payments). |
| `--ui-auth <USER:PASSWORD\|file:PATH>` | `SENDMOCK_UI_AUTH` | `ui_auth` |  | Protect the UI, API, realtime streams and MCP over HTTP: `user:password`, or `file:<path>` with `user:password` lines. |
| `--api-token <TOKEN>` | `SENDMOCK_API_TOKEN` | `api_token` |  | With --ui-auth, also accept `Authorization: Bearer <token>` (for the CLI, scripts and the docs playground). |
| `--templates-dir <DIRECTORY>` | `SENDMOCK_TEMPLATES_DIR` |  |  | A directory of webhook template files (TOML, as exported), loaded at startup and reloaded when a file changes; they are read-only in SendMock. |
| `--cors-origins <ORIGINS>` | `SENDMOCK_CORS_ORIGINS` | `cors_origins` | `https://shibbirweb.github.io` | Browser origins allowed to call the API, comma-separated; empty turns CORS off. |
| `--db <PATH\|memory>` | `SENDMOCK_DB` | `db` | sendmock.db in the OS data folder | Database file, or `memory` to keep nothing after exit. |
| `--log-format <LOG_FORMAT>` | `SENDMOCK_LOG_FORMAT` | `log_format` | `human` | Log output: readable lines, or one JSON object per line for log collectors. |
| `--log-level <LOG_LEVEL>` | `SENDMOCK_LOG_LEVEL` | `log_level` | `info` | Lowest log level shown. |
| `--seed <FILE>` | `SENDMOCK_SEED` | `seed` | ./sendmock.seed.toml when present | Seed file with the configuration to start from. |
