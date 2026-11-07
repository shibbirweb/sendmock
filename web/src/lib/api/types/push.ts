import type { IsoTimestamp, Ulid } from "@/lib/api/types/common";

export type PushProvider = "fcm" | "expo" | "onesignal";
export type PushStatus = "sent" | "failed";

/** A push notification as the provider's API received it, with what SendMock answered (PN-01). */
export type PushNotification = {
  id: Ulid;
  /** @example "fcm" */
  provider: PushProvider;
  /**
   * The id the provider's answer named, such as FCM's message name.
   * @example "projects/shop-app/messages/0:1762500000000000%a1b2c3d4e5f60718"
   */
  provider_message_id: string;
  /**
   * The FCM registration token, Expo push token or OneSignal subscription it went to; a
   * topic or condition send shows as `topic:<name>` or `condition:<expression>`.
   * @example "dQw4w9WgXcQ:APA91bE1"
   */
  device_token: string;
  /** `android`, `ios` or `web` when the message targets one. */
  platform: "android" | "ios" | "web" | null;
  /** @example "Your order shipped" */
  title: string | null;
  /** @example "Track it in the app." */
  body: string | null;
  image_url: string | null;
  /** The data payload, key to value. */
  data: Record<string, unknown>;
  status: PushStatus;
  error_reason: string | null;
  /** The request body as the app sent it. */
  request: unknown;
  /** @example 200 */
  response_status: number;
  /** What SendMock answered, in the provider's shape. */
  response: unknown;
  /** @example "default" */
  project: string;
  created_at: IsoTimestamp;
};
