---
title: Slack and push
description: Point your app's Slack webhook and push notification calls at the HTTP catcher, so nothing reaches real people, and see each one previewed.
---

> Works in your install from Phase 4 (Slack, Discord, Telegram, FCM) and Phase 5 (Teams, Google Chat, Expo, OneSignal). Try it in the [demo](/demo/http) today.

**The situation:** your app posts to Slack when an order fails and sends push notifications when it ships. During development these reach the real team channel and real phones.

**You need:** the settings where your app keeps its Slack webhook URL and push API base URL.

## Steps

1. In **HTTP**, press **New bin**. Name `slack`, preset **Slack incoming webhook**, **Add bin**.
2. Copy the catch URL, `http://127.0.0.1:8025/catch/slack`, into your app's Slack webhook setting.
3. Press **New bin** again: name `push`, preset **Firebase Cloud Messaging v1** (or Expo push, OneSignal). Set your app's FCM base URL to `http://127.0.0.1:8025/catch/push`.
4. Trigger an alert and a push in your app.

## What you should see

Each request under its bin. **Preview** shows the Slack message as Slack draws it and the push as a phone notification card; **Response** shows SendMock answered as Slack and FCM do (`200 ok`, a message name), so your app carried on.

## Try it in the demo

1. Open [HTTP](/demo/http) and press **New bin**. Name it `alerts`, pick **Slack incoming webhook**, press **Add bin**. The catch URL shows `http://127.0.0.1:8025/catch/alerts`.
2. Click the `slack` bin and its first request: **Preview** shows a Slack message.

## Next

- [HTTP catcher](../http/index.md)
- [Advanced: catcher responses](../advanced/catcher-responses.md): make the bin fail or slow down.
