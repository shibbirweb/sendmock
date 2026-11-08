import type { PushNotification } from "@/lib/api/types";
import { minutesAgo } from "@/mocks/fixtures/fixture-helpers";
import { defaultProjectKey } from "@/mocks/fixtures/project-fixtures";

type PushSpec = Pick<
  PushNotification,
  | "provider"
  | "provider_message_id"
  | "device_token"
  | "platform"
  | "title"
  | "body"
  | "image_url"
  | "data"
  | "status"
  | "error_reason"
  | "request"
  | "response_status"
  | "response"
> & { minutesAgo: number };

const shippedMessage = {
  token: "dQw4w9WgXcQ:APA91bE1",
  notification: { title: "Your order shipped", body: "Track it in the app." },
  data: { order_id: "1042" },
  android: { priority: "high" },
};

/** A sale banner, inline so the demo needs no image file. */
const saleImageUrl =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#f97316"/><text x="160" y="96" font-family="sans-serif" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">30% OFF</text></svg>',
  );

const fcmMessageName = "projects/shop-app/messages/0:1762500000000000%a1b2c3d4";

const pushSpecs: PushSpec[] = [
  {
    minutesAgo: 1,
    provider: "fcm",
    provider_message_id: fcmMessageName,
    device_token: shippedMessage.token,
    platform: "android",
    title: shippedMessage.notification.title,
    body: shippedMessage.notification.body,
    image_url: null,
    data: shippedMessage.data,
    status: "sent",
    error_reason: null,
    request: { message: shippedMessage },
    response_status: 200,
    response: { name: fcmMessageName },
  },
  {
    minutesAgo: 6,
    provider: "expo",
    provider_message_id: "6f1c2a7e-0b5d-4c8e-9a3f-2d7b1e6c4a90",
    device_token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    platform: null,
    title: "Rahim sent you a message",
    body: "Are we still on for tomorrow?",
    image_url: null,
    data: { chat_id: "c-17" },
    status: "sent",
    error_reason: null,
    request: {
      to: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      title: "Rahim sent you a message",
      body: "Are we still on for tomorrow?",
      data: { chat_id: "c-17" },
      sound: "default",
    },
    response_status: 200,
    response: { status: "ok", id: "6f1c2a7e-0b5d-4c8e-9a3f-2d7b1e6c4a90" },
  },
  {
    minutesAgo: 14,
    provider: "onesignal",
    provider_message_id: "b98881cc-1e94-4366-bbd9-db8f3429292b",
    device_token: "external_id:user-7",
    platform: "ios",
    title: "Flash sale",
    body: "30% off everything until midnight.",
    image_url: saleImageUrl,
    data: { campaign: "flash-sale" },
    status: "sent",
    error_reason: null,
    request: {
      app_id: "5eb5a37e-b458-11e3-ac11-000c2940e62c",
      include_aliases: { external_id: ["user-7"] },
      headings: { en: "Flash sale" },
      contents: { en: "30% off everything until midnight." },
      ios_attachments: { sale: saleImageUrl },
      data: { campaign: "flash-sale" },
      is_ios: true,
    },
    response_status: 200,
    response: { id: "b98881cc-1e94-4366-bbd9-db8f3429292b", external_id: null },
  },
  {
    minutesAgo: 32,
    provider: "fcm",
    provider_message_id: "",
    device_token: "old-device-unregistered",
    platform: null,
    title: "Your sign-in code",
    body: "Your code is 482913.",
    image_url: null,
    data: {},
    status: "failed",
    error_reason: "UNREGISTERED",
    request: {
      message: {
        token: "old-device-unregistered",
        notification: {
          title: "Your sign-in code",
          body: "Your code is 482913.",
        },
      },
    },
    response_status: 404,
    response: {
      error: {
        code: 404,
        message: "Requested entity was not found.",
        status: "NOT_FOUND",
      },
    },
  },
];

/** A few notifications from each provider, one refused, for the demo and the Deeper crawl. */
export function buildPushFixtures(): PushNotification[] {
  return pushSpecs.map(
    ({ minutesAgo: sentMinutesAgo, ...pushSpec }, index) => ({
      ...pushSpec,
      id: `01JR0000000000000000000${String(index + 1).padStart(3, "0")}`,
      project: defaultProjectKey,
      created_at: minutesAgo(sentMinutesAgo),
    }),
  );
}
