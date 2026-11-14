# Security policy

SendMock is a local testing tool: it binds to `127.0.0.1` by default and is not meant to face the internet. Still, it handles your test traffic, webhook secrets and gateway credentials, so security reports are taken seriously.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest stable release | Yes |
| Latest beta from `develop` | Yes, fixed in the next beta |
| Older releases | No; please upgrade |

## Reporting a vulnerability

Please report privately through GitHub's [private vulnerability reporting](https://github.com/shibbirweb/sendmock/security/advisories/new). Do not open a public issue, discussion or pull request for a vulnerability.

Include what you found, how to reproduce it, the version and how you run SendMock (binary, Docker, Homebrew).

## What to expect

- An acknowledgement within 3 working days.
- An assessment and a plan within 10 working days.
- A fixed release as soon as it is ready, and credit in the advisory if you would like it.
