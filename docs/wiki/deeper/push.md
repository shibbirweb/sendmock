---
title: Push in depth
description: Every control and text of Push and a notification's drawer.
---

> Every control and text this screen shows, in screen order. The list is read from the demo by a crawl, and CI fails when the screen changes without its entry here.

Push shows every notification your app sends through FCM, Expo or OneSignal, as a phone's lock screen would show it.

The screen as a whole: [Push](../push.md).

![Push, with a number on each control](./images/push.jpg)

The numbers match the entries below. The picture shows the first screenful; controls further down, and texts, have no marker.

## On the screen

### 1. Push

Heading.

- **What it does:** Names the screen.

### 2. Read the Push guide

Link.

- **What it does:** Opens this screen's page in the user guide, in a new tab.
- **Links to:** [Push](../push.md).

### 3. Every push notification your app sends through FCM, Expo or OneSignal, as the phone would show it.

Text.

- **What it does:** Explains the screen.

### 4. All

Button.

- **What it does:** Shows notifications from every provider.
- **Same action elsewhere:** REST [`GET /api/v1/push`](/api/push/#getPush), CLI [`sendmock push list`](/cli/push/#push-list), MCP [`sendmock_push_list`](/mcp/push/#sendmock_push_list)

### 5. FCM

Button.

- **What it does:** Shows only notifications sent through Firebase Cloud Messaging.

### 6. Expo

Button.

- **What it does:** Shows only notifications sent through Expo.

### 7. OneSignal

Button.

- **What it does:** Shows only notifications sent through OneSignal.

### 8. Sent

Button.

- **What it does:** Shows only notifications the provider accepted; press again to show every status.

### 9. Failed

Button.

- **What it does:** Shows only notifications the provider refused, such as one to an unregistered token; press again to show every status.

### 10. Filter by device token

Field.

- **What it does:** Shows only notifications to this exact device token, Expo push token, OneSignal subscription or alias (`external_id:user-7`).

### 11. Select all loaded push notifications

Checkbox.

- **What it does:** Ticks every row loaded in the list, or clears the ticks; it shows a dash when only some are ticked, and the toolbar says how many are selected. Ticked rows can be marked read, marked unread or deleted together. X ticks the open or focused row.

### 12. Delete all push notifications

Button.

- **What it does:** Asks first, naming how many go and what stays, then deletes every row the list shows, in the picked project. While a search or filter is on it reads Delete matching and deletes only what it matches.
- **What it changes:** Publishes one `traffic.cleared` event, so every open tab refreshes; settings and configuration stay.
- **Same action elsewhere:** REST [`DELETE /api/v1/push`](/api/push/#deletePush), CLI [`sendmock push clear`](/cli/push/#push-clear), MCP [`sendmock_push_delete_all`](/mcp/push/#sendmock_push_delete_all)

### 13. Select

Column.

- **What it does:** The column of tick boxes; it has no visible title.

### 14. Notification

Column.

- **What it does:** The notification's title, or its body when it has no title.

### 15. Device token

Column.

- **What it does:** Where it went: a token, `topic:<name>`, `condition:<expression>`, `<alias>:<id>` or `segment:<names>`.

### 16. Provider

Column.

- **What it does:** FCM, Expo or OneSignal.

### 17. Status

Column.

- **What it does:** Sent, or Failed when the provider refused it.

### 18. Time

Column.

- **What it does:** When your app sent it.

### 19. Select push to …

Checkbox, in each row.

- **What it does:** Ticks this row, so the toolbar can act on it. Shown on hover, on focus and while anything is ticked, and always on touch screens.

### 20. Unread

Badge, in each row.

- **What it does:** Marks a notification nobody opened yet. Opening it marks it read; Mark unread puts the dot back, and the sidebar counts the unread ones.
- **Where its text comes from:** The item's `is_read` field.

### 21. …

Link, in each row.

- **What it does:** Opens the notification's drawer.
- **Same action elsewhere:** REST [`GET /api/v1/push/{pushId}`](/api/push/#getPushByPushId), CLI [`sendmock push show`](/cli/push/#push-show), MCP [`sendmock_push_get`](/mcp/push/#sendmock_push_get)

## A notification is open

### 22. Push notification

Heading.

- **What it does:** The drawer of one notification; its id is in the URL as `?push=`.

### 23. As the phone shows it, with its data, the request and the answer.

Text.

- **What it does:** Explains the drawer.

### 24. iOS

Choice.

- **What it does:** Shows the lock screen card as iOS draws it, with the image beside the text.

### 25. Android

Choice.

- **What it does:** Shows the card as Android draws it, with the image below the text. The message's platform picks the style first.

### 26. Flash sale

Text.

- **What it does:** The notification's title on the card.
- **Where its text comes from:** FCM's `notification.title` (or a platform block's), Expo's `title`, OneSignal's `headings` in English.

### 27. #% off everything until midnight.

Text.

- **What it does:** The notification's body on the card.
- **Where its text comes from:** FCM's `notification.body`, Expo's `body`, OneSignal's `contents` in English.

### 28. Data

Heading.

- **What it does:** The data payload as key and value rows, as the app receives it.

### 29. Request

Heading.

- **What it does:** The request body as your app sent it (for Expo, the one message).

### 30. Copy request

Button.

- **What it does:** Copies the request as JSON.

### 31. Answer (#)

Heading.

- **What it does:** What SendMock answered, in the provider's own shape, with its HTTP status.

### 32. Copy answer (#)

Button.

- **What it does:** Copies the answer as JSON.

### 33. Delete

Button.

- **What it does:** Asks, then deletes this notification and closes the drawer.
- **Same action elsewhere:** REST [`DELETE /api/v1/push/{pushId}`](/api/push/#deletePushByPushId), CLI [`sendmock push delete`](/cli/push/#push-delete), MCP [`sendmock_push_delete`](/mcp/push/#sendmock_push_delete)

### 34. Close

Button.

- **What it does:** Closes the drawer (or press `Esc`).

## Delete all dialog

### 35. Delete all # push notifications?

Heading.

- **What it does:** The confirmation before deleting every row the list shows; the number is how many go.

### 36. Settings and configuration stay. This cannot be undone.

Text.

- **What it does:** Says what stays.

### 37. Cancel

Button.

- **What it does:** Closes the dialog without deleting.

### 38. Delete all

Button.

- **What it does:** Deletes every row the list shows.
- **Same action elsewhere:** REST [`DELETE /api/v1/push`](/api/push/#deletePush), CLI [`sendmock push clear`](/cli/push/#push-clear), MCP [`sendmock_push_delete_all`](/mcp/push/#sendmock_push_delete_all)

## With no data yet

### 39. No push notifications yet

Text.

- **What it does:** Shown when no app has sent a notification yet.

### 40. Point your app's FCM, Expo or OneSignal SDK at SendMock and send one. It shows up here as the phone would show it.

Text.

- **What it does:** Explains how notifications arrive.

### 41. This machine

Choice.

- **What it does:** Shows the addresses for an app on the same machine.
- **What it changes:** Shared with Settings > Connection and remembered in the browser.
- **Same action elsewhere:** REST [`GET /api/v1/info`](/api/system/#getInfo), CLI [`sendmock status`](/cli/system/#status), MCP [`sendmock_status`](/mcp/system/#sendmock_status)

### 42. Docker host

Choice.

- **What it does:** Shows the addresses for an app in a container reaching SendMock on the host.

### 43. Compose

Choice.

- **What it does:** Shows the addresses for an app in the same Docker Compose project.

### 44. Copy FCM base URL

Button.

- **What it does:** Copies the address to send FCM HTTP v1 requests to.

### 45. Copy EXPO_BASE_URL

Button.

- **What it does:** Copies the value for the `EXPO_BASE_URL` environment variable, which `expo-server-sdk` reads.

### 46. Copy OneSignal base URL

Button.

- **What it does:** Copies the address to give the OneSignal SDK as its server.

### 47. More snippets

Link.

- **What it does:** Opens Settings > Connection.
- **Links to:** [Settings](../settings.md).

## When the data cannot load

### 48. Could not load push notifications. Try again

Message.

- **What it does:** Shown when the notifications could not be loaded.
- **Errors:** Check SendMock is running, then press Try again.

### 49. Could not load push notifications.

Text.

- **What it does:** The message inside the alert.

### 50. Try again

Button.

- **What it does:** Loads the notifications again.
- **Same action elsewhere:** REST [`GET /api/v1/push`](/api/push/#getPush), CLI [`sendmock push list`](/cli/push/#push-list), MCP [`sendmock_push_list`](/mcp/push/#sendmock_push_list)
