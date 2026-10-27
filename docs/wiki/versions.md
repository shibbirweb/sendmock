---
title: Docs versions
description: Which docs to read for the SendMock you run, the beta docs, and how to switch between versions.
---

> **No stable release yet.** Until the first one, the main docs are a **Preview** that follows `develop`, the same as the beta docs.

Every SendMock release keeps its own docs, so the steps and screenshots you read match the version you run.

| Docs | Address | Read them when you run |
| --- | --- | --- |
| **Stable** | `/docs/` | the latest stable release (Homebrew `sendmock`, Docker `latest`, the default install script) |
| **Beta (next)** | `/next/docs/` | a beta (Homebrew `sendmock-beta`, Docker `beta` or `edge`, `--channel beta`) or a build of `develop` |
| **Older versions** | `/v0.2/docs/`, `/v0.1/docs/`, ... | an older stable minor version; each shows the newest patch of that minor |

Beta and older docs show a banner at the top of every page, with a link to the latest stable docs.

## Switch to another version

1. Open the **Version** menu at the top of the docs sidebar, under the search box.
2. Pick a version. The same page opens in that version.
3. If the page does not exist there, the "Page not found" page links to the docs home of every version.

## Find the docs for the SendMock you run

1. Check your version:

   ```bash
   sendmock --version
   ```

2. Open the docs that match:
   - a version without `-beta` (for example `0.3.1`): the stable docs, or `/v0.3/docs/` once a newer minor is out;
   - a version with `-beta` (for example `0.4.0-beta.2`), `edge` or `dev`: the beta docs at `/next/docs/`.

The app does this for you: the guide links in its header and the Help menu open the docs of its own version.

## Related

- [Install](./install.md): stable and beta builds for every system
- [Getting started](./getting-started.md)
