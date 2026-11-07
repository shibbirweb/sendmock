// AC: PN-01.1 PN-01.2 PN-01.3 PN-01.4
// Each push provider's official Node SDK sends to a running SendMock: firebase-admin's
// messaging, expo-server-sdk and OneSignal's SDK. The app waits for every notification through
// SendMock's API, then sends to a magic `unregistered` token and checks the SDK reports the
// provider's own error.
//
// Expo's SDK reads EXPO_BASE_URL when it loads, so it is set before node starts. OneSignal's
// takes a base server. firebase-admin only knows https://fcm.googleapis.com and has no base URL
// setting, so the app wraps Node's https.request to send that host to the provider port, as
// the PayPal example wraps its SDK's HTTP client.
import http from "node:http";
import https from "node:https";

import * as OneSignal from "@onesignal/node-onesignal";
import { Expo } from "expo-server-sdk";
import { initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const providerUrl = new URL(process.env.SENDMOCK_PROVIDER_URL ?? "http://127.0.0.1:8026");
const fcmHost = "fcm.googleapis.com";
/** What the app is doing, so a failure in CI names the step. */
let currentStep = "starting";

const sendHttpsRequest = https.request;
https.request = (requestOptions, ...requestArguments) => {
  if (requestOptions?.hostname !== fcmHost) {
    return sendHttpsRequest(requestOptions, ...requestArguments);
  }
  return http.request(
    {
      ...requestOptions,
      protocol: "http:",
      hostname: providerUrl.hostname,
      port: providerUrl.port,
      agent: undefined,
    },
    ...requestArguments,
  );
};

/** Waits until SendMock has a notification to the token, and answers it. */
async function waitForPush(deviceToken) {
  const query = new URLSearchParams({ device_token: deviceToken, timeout: "10s" });
  const response = await fetch(`${sendmockUrl}/api/v1/wait/push?${query}`);
  if (!response.ok) {
    throw new Error(`No push to ${deviceToken}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function expectEqual(actualValue, expectedValue, label) {
  if (actualValue !== expectedValue) {
    throw new Error(`${label}: expected ${expectedValue}, got ${actualValue}`);
  }
}

async function sendWithFirebaseAdmin() {
  currentStep = "firebase-admin";
  const firebaseApp = initializeApp({
    projectId: "shop-app",
    credential: {
      getAccessToken: async () => ({ access_token: "sendmock-example", expires_in: 3600 }),
    },
  });
  const messaging = getMessaging(firebaseApp);
  const messageName = await messaging.send({
    token: "fcm-device-1",
    notification: { title: "Your order shipped", body: "Track it in the app." },
    data: { order_id: "1042" },
  });
  if (!messageName.startsWith("projects/shop-app/messages/")) {
    throw new Error(`Unexpected message name ${messageName}`);
  }
  const storedPush = await waitForPush("fcm-device-1");
  expectEqual(storedPush.title, "Your order shipped", "FCM title");
  expectEqual(storedPush.data.order_id, "1042", "FCM data");

  currentStep = "firebase-admin with an unregistered token";
  try {
    await messaging.send({ token: "fcm-unregistered", notification: { title: "Gone" } });
    throw new Error("firebase-admin sent to an unregistered token");
  } catch (sendError) {
    expectEqual(sendError.code, "messaging/registration-token-not-registered", "FCM error code");
  }
}

async function sendWithExpo() {
  currentStep = "expo-server-sdk";
  const expo = new Expo();
  // A batch over 1 KB, which the SDK sends gzipped.
  const messages = Array.from({ length: 12 }, (_, messageIndex) => ({
    to: `ExponentPushToken[device-${messageIndex}]`,
    title: "Your table is ready",
    body: `Show this at the door, guest ${messageIndex}. We saved the window seat for you.`,
    data: { booking_id: `b-${messageIndex}` },
  }));
  const tickets = await expo.sendPushNotificationsAsync(messages);
  expectEqual(tickets.length, 12, "Expo tickets");
  const storedPush = await waitForPush("ExponentPushToken[device-11]");
  expectEqual(storedPush.data.booking_id, "b-11", "Expo data");
  const receipts = await expo.getPushNotificationReceiptsAsync([tickets[0].id]);
  expectEqual(receipts[tickets[0].id]?.status, "ok", "Expo receipt");

  currentStep = "expo-server-sdk with an unregistered token";
  const [errorTicket] = await expo.sendPushNotificationsAsync([
    { to: "ExponentPushToken[unregistered]", title: "Gone" },
  ]);
  expectEqual(errorTicket.status, "error", "Expo ticket status");
  expectEqual(errorTicket.details?.error, "DeviceNotRegistered", "Expo ticket error");
}

async function sendWithOneSignal() {
  currentStep = "@onesignal/node-onesignal";
  const oneSignalClient = new OneSignal.DefaultApi(
    OneSignal.createConfiguration({
      restApiKey: "sendmock-example",
      baseServer: new OneSignal.ServerConfiguration(providerUrl.origin, {}),
    }),
  );
  const notification = new OneSignal.Notification();
  notification.app_id = "5eb5a37e-b458-11e3-ac11-000c2940e62c";
  notification.headings = { en: "Flash sale" };
  notification.contents = { en: "30% off everything until midnight." };
  notification.include_subscription_ids = ["onesignal-subscription-1", "unregistered-2"];
  const answer = await oneSignalClient.createNotification(notification);
  if (!answer.id) {
    throw new Error(`OneSignal answered no id: ${JSON.stringify(answer)}`);
  }
  const storedPush = await waitForPush("onesignal-subscription-1");
  expectEqual(storedPush.body, "30% off everything until midnight.", "OneSignal body");
  expectEqual(answer.errors?.invalid_player_ids?.[0], "unregistered-2", "OneSignal refusal");
}

try {
  if (process.env.EXPO_BASE_URL === undefined) {
    throw new Error("Set EXPO_BASE_URL to SendMock's provider port before starting node");
  }
  await sendWithFirebaseAdmin();
  await sendWithExpo();
  await sendWithOneSignal();
  console.log("firebase-admin, expo-server-sdk and OneSignal sent through SendMock.");
} catch (stepError) {
  console.error(`Failed at ${currentStep}:`, stepError);
  process.exit(1);
}
