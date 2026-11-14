import {
  type ApiEndpoint,
  pageOf,
  pageQueryParameters,
  projectQueryParameter,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const pushFilterParameters = [
  projectQueryParameter("notifications"),
  {
    name: "device_token",
    description: "Only notifications to this device token.",
    schema: "string" as const,
    example: "dQw4w9WgXcQ:APA91bE1",
  },
  {
    name: "provider",
    description: "fcm, expo or onesignal.",
    schema: typeRef("PushProvider"),
    example: "fcm",
  },
  {
    name: "status",
    description: "sent or failed.",
    schema: typeRef("PushStatus"),
    example: "sent",
  },
];

/** Push notifications the provider APIs received (docs/plan/32-after-1-0.md, A7). */
export const pushApi: ApiEndpoint[] = tagEndpoints("Push", [
  {
    method: "GET",
    path: "/api/v1/push",
    summary: "Push notifications, newest first, with filters.",
    queryParameters: [...pageQueryParameters, ...pushFilterParameters],
    response: pageOf("PushNotification"),
  },
  {
    method: "DELETE",
    path: "/api/v1/push",
    summary: "Delete every push notification, or one project's.",
    queryParameters: pushFilterParameters,
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/push/{pushId}",
    summary: "One push notification with its request and answer.",
    response: typeRef("PushNotification"),
    errorStatuses: [404],
  },
  {
    method: "DELETE",
    path: "/api/v1/push/{pushId}",
    summary: "Delete one push notification.",
    response: null,
    successStatus: 204,
  },
  {
    method: "GET",
    path: "/api/v1/wait/push",
    summary: "Wait until a matching push notification arrives; 408 on timeout.",
    queryParameters: [
      {
        name: "device_token",
        description: "The device token.",
        schema: "string",
        example: "dQw4w9WgXcQ:APA91bE1",
      },
      projectQueryParameter("notifications"),
      {
        name: "since",
        description:
          "Only notifications sent after this time (default: 30 s ago).",
        schema: "string",
        example: "2026-11-07T10:00:00Z",
      },
      {
        name: "timeout",
        description: "How long to wait, e.g. 10s (default 10s, at most 60s).",
        schema: "string",
        example: "10s",
      },
    ],
    response: typeRef("PushNotification"),
    errorStatuses: [408],
  },
]);
