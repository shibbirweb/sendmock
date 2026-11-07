# Acceptance: Push notifications (PN)

Plan: [32-after-1-0.md](../32-after-1-0.md#a7-push-notifications-pn-01). Rules for IDs, ticking and tests: [README.md](README.md).

## PN-01 Push notifications

After 1.0, built on `feat/phase-0` by owner decision (2026-11-07). Plan: [32-after-1-0.md](../32-after-1-0.md#a7-push-notifications-pn-01).

- [ ] PN-01.1 FCM HTTP v1's send API stores the notification (token, title, body, data, image) and answers the message name in FCM's shape; the `firebase-admin` Node SDK sends through it.
- [ ] PN-01.2 Expo's send API stores each message of a single or batched request and answers tickets, `getReceipts` answers their receipts; the `expo-server-sdk` sends through it.
- [ ] PN-01.3 OneSignal's notifications API stores the notification for its subscriptions or aliases and answers its id; the OneSignal Node SDK sends through it.
- [ ] PN-01.4 Magic device tokens fail as each provider does: `unregistered`, `invalid` and `throttled` tokens get the provider's own error shape and status, and the notification is stored as failed with the reason.
- [ ] PN-01.5 Push has REST, CLI and MCP surfaces: list (with `project`, `token`, `provider`), one notification, delete, and wait for a notification; `push.sent` and `push.failed` events reach webhook rules.
- [ ] PN-01.6 The Push screen lists notifications and shows one with a phone-style preview, its data, the request and the answer, in mock and live mode.
