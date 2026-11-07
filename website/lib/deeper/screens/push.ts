import type { DeeperEntry, DeeperPage } from "../deeper-types";

const pushListEntries: DeeperEntry[] = [
  { control: "heading: Push", does: "Names the screen." },
  {
    control: "link: Read the Push guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Push](../push.md).",
  },
  {
    control:
      "paragraph: Every push notification your app sends through FCM, Expo or OneSignal, as the phone would show it.",
    does: "Explains the screen.",
  },
  {
    control: "button: All",
    does: "Shows notifications from every provider.",
    operationIds: ["getPush"],
  },
  {
    control: "button: FCM",
    does: "Shows only notifications sent through Firebase Cloud Messaging.",
  },
  {
    control: "button: Expo",
    does: "Shows only notifications sent through Expo.",
  },
  {
    control: "button: OneSignal",
    does: "Shows only notifications sent through OneSignal.",
  },
  {
    control: "button: Sent",
    does: "Shows only notifications the provider accepted; press again to show every status.",
  },
  {
    control: "button: Failed",
    does: "Shows only notifications the provider refused, such as one to an unregistered token; press again to show every status.",
  },
  {
    control: "textbox: Filter by device token",
    does: "Shows only notifications to this exact device token, Expo push token, OneSignal subscription or alias (`external_id:user-7`).",
  },
  {
    control: "button: Clear all",
    does: "Asks, then deletes every notification the filters show.",
  },
  {
    control: "columnheader: Notification",
    does: "The notification's title, or its body when it has no title.",
  },
  {
    control: "columnheader: Device token",
    does: "Where it went: a token, `topic:<name>`, `condition:<expression>`, `<alias>:<id>` or `segment:<names>`.",
  },
  { control: "columnheader: Provider", does: "FCM, Expo or OneSignal." },
  {
    control: "columnheader: Status",
    does: "Sent, or Failed when the provider refused it.",
  },
  { control: "columnheader: Time", does: "When your app sent it." },
  {
    control: "each item, link: …",
    does: "Opens the notification's drawer.",
    operationIds: ["getPushByPushId"],
  },
];

const pushDrawerEntries: DeeperEntry[] = [
  {
    control: "heading: Push notification",
    does: "The drawer of one notification; its id is in the URL as `?push=`.",
  },
  {
    control:
      "paragraph: As the phone shows it, with its data, the request and the answer.",
    does: "Explains the drawer.",
  },
  {
    control: "radio: iOS",
    does: "Shows the lock screen card as iOS draws it, with the image beside the text.",
  },
  {
    control: "radio: Android",
    does: "Shows the card as Android draws it, with the image below the text. The message's platform picks the style first.",
  },
  {
    control: "paragraph: Flash sale",
    does: "The notification's title on the card.",
    source:
      "FCM's `notification.title` (or a platform block's), Expo's `title`, OneSignal's `headings` in English.",
  },
  {
    control: "paragraph: #% off everything until midnight.",
    does: "The notification's body on the card.",
    source:
      "FCM's `notification.body`, Expo's `body`, OneSignal's `contents` in English.",
  },
  {
    control: "heading: Data",
    does: "The data payload as key and value rows, as the app receives it.",
  },
  {
    control: "heading: Request",
    does: "The request body as your app sent it (for Expo, the one message).",
  },
  { control: "button: Copy request", does: "Copies the request as JSON." },
  {
    control: "heading: Answer (#)",
    does: "What SendMock answered, in the provider's own shape, with its HTTP status.",
  },
  { control: "button: Copy answer (#)", does: "Copies the answer as JSON." },
  {
    control: "button: Delete",
    does: "Asks, then deletes this notification and closes the drawer.",
    operationIds: ["deletePushByPushId"],
  },
  { control: "button: Close", does: "Closes the drawer (or press `Esc`)." },
];

const pushDialogAndStateEntries: DeeperEntry[] = [
  {
    control: "heading: Clear every push notification?",
    does: "Asks before Clear all.",
  },
  {
    control:
      "paragraph: Every notification this list shows is deleted; tests waiting for one see only new ones.",
    does: "Explains what Clear all deletes.",
  },
  { control: "button: Keep them", does: "Closes the dialog without deleting." },
  {
    control: "button: Clear all",
    state: "Clear all dialog",
    does: "Deletes every notification the filters show.",
    operationIds: ["deletePush"],
  },
  {
    control: "paragraph: No push notifications yet",
    does: "Shown when no app has sent a notification yet.",
  },
  {
    control:
      "paragraph: Point your app's FCM, Expo or OneSignal SDK at SendMock and send one. It shows up here as the phone would show it.",
    does: "Explains how notifications arrive.",
  },
  {
    control: "radio: This machine",
    does: "Shows the addresses for an app on the same machine.",
    changes: "Shared with Settings > Connection and remembered in the browser.",
    operationIds: ["getInfo"],
  },
  {
    control: "radio: Docker host",
    does: "Shows the addresses for an app in a container reaching SendMock on the host.",
  },
  {
    control: "radio: Compose",
    does: "Shows the addresses for an app in the same Docker Compose project.",
  },
  {
    control: "button: Copy FCM base URL",
    does: "Copies the address to send FCM HTTP v1 requests to.",
  },
  {
    control: "button: Copy EXPO_BASE_URL",
    does: "Copies the value for the `EXPO_BASE_URL` environment variable, which `expo-server-sdk` reads.",
  },
  {
    control: "button: Copy OneSignal base URL",
    does: "Copies the address to give the OneSignal SDK as its server.",
  },
  {
    control: "link: More snippets",
    does: "Opens Settings > Connection.",
    links: "[Settings](../settings.md).",
  },
  {
    control: "alert: Could not load push notifications. Try again",
    does: "Shown when the notifications could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load push notifications.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the notifications again.",
    operationIds: ["getPush"],
  },
];

/** Push: notifications from FCM, Expo and OneSignal, and one notification's drawer. */
export const pushPage: DeeperPage = {
  screen: "/push",
  file: "push.md",
  title: "Push in depth",
  description: "Every control and text of Push and a notification's drawer.",
  guidePage: "push.md",
  guideTitle: "Push",
  intro:
    "Push shows every notification your app sends through FCM, Expo or OneSignal, as a phone's lock screen would show it.",
  entries: [
    ...pushListEntries,
    ...pushDrawerEntries,
    ...pushDialogAndStateEntries,
  ],
};
