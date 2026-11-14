# Push examples

`node/` sends push notifications with each push provider's official Node SDK: `firebase-admin` (FCM HTTP v1), `expo-server-sdk` and `@onesignal/node-onesignal`. Expo's SDK reads `EXPO_BASE_URL`, OneSignal's takes a base server, and `firebase-admin`, which only knows `https://fcm.googleapis.com`, has its requests sent to the provider port by a small wrapper around Node's `https.request`. The app waits for every notification with `GET /api/v1/wait/push`, then sends to a magic `unregistered` token and checks each SDK reports the provider's own error. CI runs it against a release binary cut off from the network (`.github/workflows/push-sdks.yml`).

To run it by hand (Node 22.12 or later):

1. Start SendMock with the provider port.

   ```sh
   sendmock --db memory --provider-addr 127.0.0.1:8026
   ```

2. Go to the example.

   ```sh
   cd examples/push/node
   ```

3. Install the SDKs.

   ```sh
   bun install
   ```

4. Point Expo's SDK at SendMock.

   ```sh
   export EXPO_BASE_URL=http://127.0.0.1:8026
   ```

5. Send with every SDK.

   ```sh
   node done-when.js
   ```
