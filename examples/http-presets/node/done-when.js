// AC: HC-03.1
// The official client libraries of the services the HTTP Catcher's presets stand in for send to
// a bin with that preset, and each accepts the bin's reply without an error: Slack's
// `@slack/webhook`, Expo's `expo-server-sdk`, OneSignal's `@onesignal/node-onesignal` and
// Firebase Admin's messaging for FCM. Discord, Microsoft Teams, Google Chat and Telegram have no
// official library for their webhooks; their replies' shapes are checked with the presets (HC-02).
import http from "node:http";
import https from "node:https";

const sendmockUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
const catchUrl = (binName) => `${sendmockUrl}/catch/${binName}`;
/** What the app is doing, so a failure in CI names the step. */
let currentStep = "starting";

async function callSendMock(method, path, requestBody) {
  const response = await fetch(`${sendmockUrl}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  const answerText = await response.text();
  if (!response.ok) {
    throw new Error(
      `${method} ${path} answered ${response.status}: ${answerText}`,
    );
  }
  return answerText === "" ? null : JSON.parse(answerText);
}

function expectTrue(condition, description) {
  if (!condition) {
    throw new Error(description);
  }
}

async function createBin(binName, preset) {
  currentStep = `create the ${preset} bin`;
  await callSendMock("POST", "/http/bins", { name: binName, preset });
}

async function sendWithSlack() {
  await createBin("slack-hooks", "slack");
  currentStep = "send with @slack/webhook";
  const { IncomingWebhook } = await import("@slack/webhook");
  const incomingWebhook = new IncomingWebhook(
    `${catchUrl("slack-hooks")}/services/T000/B000/XXXX`,
  );
  const slackResult = await incomingWebhook.send({ text: "Deploy finished" });
  expectTrue(
    slackResult.text === "ok",
    `Slack answered ${JSON.stringify(slackResult)}`,
  );
}

async function sendWithExpo() {
  await createBin("expo-push", "expo");
  currentStep = "send with expo-server-sdk";
  // Read when the module loads: the SDK's own setting for a local push service.
  process.env.EXPO_BASE_URL = catchUrl("expo-push");
  const { Expo } = await import("expo-server-sdk");
  const expo = new Expo();
  const tickets = await expo.sendPushNotificationsAsync([
    {
      to: "ExponentPushToken[sendmockdevice000000000]",
      title: "Order",
      body: "Your order shipped",
    },
  ]);
  expectTrue(
    tickets[0]?.status === "ok",
    `Expo answered ${JSON.stringify(tickets)}`,
  );
}

async function sendWithOneSignal() {
  await createBin("onesignal-push", "onesignal");
  currentStep = "send with @onesignal/node-onesignal";
  const OneSignal = await import("@onesignal/node-onesignal");
  const configuration = OneSignal.createConfiguration({
    restApiKey: "sendmock-onesignal-key",
    baseServer: new OneSignal.ServerConfiguration(
      catchUrl("onesignal-push"),
      {},
    ),
  });
  const oneSignalClient = new OneSignal.DefaultApi(configuration);
  const notification = new OneSignal.Notification();
  notification.app_id = "00000000-0000-0000-0000-000000000000";
  notification.contents = { en: "Your order shipped" };
  notification.included_segments = ["Subscribed Users"];
  const oneSignalResult =
    await oneSignalClient.createNotification(notification);
  expectTrue(
    typeof oneSignalResult.id === "string",
    `OneSignal answered ${JSON.stringify(oneSignalResult)}`,
  );
}

/**
 * Firebase Admin only knows fcm.googleapis.com, so its HTTPS calls to that host go to the bin
 * instead; the credential is a test one, since nothing reaches Google.
 */
function sendFcmToBin() {
  const httpsRequest = https.request;
  https.request = (requestOptions, ...remainingArguments) => {
    const options =
      typeof requestOptions === "string"
        ? new URL(requestOptions)
        : requestOptions;
    if (
      options.hostname !== "fcm.googleapis.com" &&
      options.host !== "fcm.googleapis.com"
    ) {
      return httpsRequest(requestOptions, ...remainingArguments);
    }
    const binUrl = new URL(catchUrl("fcm-push"));
    return http.request(
      {
        ...options,
        protocol: "http:",
        hostname: binUrl.hostname,
        host: binUrl.hostname,
        port: binUrl.port,
        path: `${binUrl.pathname}${options.path}`,
        agent: undefined,
      },
      ...remainingArguments,
    );
  };
}

async function sendWithFirebaseAdmin() {
  await createBin("fcm-push", "fcm");
  currentStep = "send with firebase-admin";
  sendFcmToBin();
  const { initializeApp } = await import("firebase-admin/app");
  const { getMessaging } = await import("firebase-admin/messaging");
  const firebaseApp = initializeApp({
    projectId: "demo",
    credential: {
      getAccessToken: async () => ({
        access_token: "sendmock-test-token",
        expires_in: 3600,
      }),
    },
  });
  const messageName = await getMessaging(firebaseApp).send({
    token: "sendmock-device-token",
    notification: { title: "Order", body: "Your order shipped" },
  });
  expectTrue(
    messageName.startsWith("projects/demo/messages/"),
    `FCM answered ${messageName}`,
  );
}

async function main() {
  await sendWithSlack();
  await sendWithExpo();
  await sendWithOneSignal();
  await sendWithFirebaseAdmin();
  currentStep = "read the captured requests";
  const captured = await callSendMock("GET", "/http/requests?limit=20");
  const capturedBins = new Set(
    (captured.items ?? []).map((capturedRequest) => capturedRequest.bin_name),
  );
  for (const binName of [
    "slack-hooks",
    "expo-push",
    "onesignal-push",
    "fcm-push",
  ]) {
    expectTrue(capturedBins.has(binName), `Nothing captured in ${binName}`);
  }
  console.log(
    "Done: Slack, Expo, OneSignal and FCM's official libraries accepted the presets' replies.",
  );
}

main().catch((error) => {
  console.error(error);
  // CI job logs need a token to read; an annotation shows the reason on the run itself.
  console.log(
    `::error title=HTTP presets app::step: ${currentStep} | ${String(error.message).replace(/\r?\n/g, " ")}`,
  );
  process.exit(1);
});
