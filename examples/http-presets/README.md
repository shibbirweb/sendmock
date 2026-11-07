# HTTP preset examples

The official client libraries of the services the HTTP Catcher's presets stand in for, sending to a bin with that preset: Slack's `@slack/webhook`, Expo's `expo-server-sdk` (through its `EXPO_BASE_URL` setting), OneSignal's `@onesignal/node-onesignal` (through its `baseServer`) and Firebase Admin's messaging for FCM (its HTTPS calls to `fcm.googleapis.com` are sent to the bin, with a test credential). Each accepts the bin's reply without an error. Discord, Microsoft Teams, Google Chat and Telegram have no official library for their webhooks.

CI runs it against a release binary in the Example apps workflow. To run it by hand:

1. Start SendMock.

   ```sh
   sendmock --db memory
   ```

2. Go to the example.

   ```sh
   cd examples/http-presets/node
   ```

3. Install the libraries.

   ```sh
   bun install
   ```

4. Send through each library.

   ```sh
   node done-when.js
   ```
