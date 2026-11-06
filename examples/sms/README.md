# SMS client examples

Each folder uses a provider's official SDK the way an app does, pointed at SendMock's provider port. It sends an SMS with a status callback to a small local handler, waits for the `queued`, `sent` and `delivered` callbacks, then runs a Twilio Verify login with the code read from `/api/v1/otp`. CI runs every one against a release binary (`.github/workflows/sms-clients.yml`).

The SDK keeps its real base URL; a custom HTTP client (the SDK's own extension point) sends each request to the provider port with the same path and query. Each SDK has its own: a `RequestClient` subclass in Node, a `TwilioHttpClient` subclass in Python, a `CurlClient` subclass in PHP, an `http.Client` transport in Go, a `com.twilio.http.HttpClient` in Java, a `DelegatingHandler` under `SystemNetHttpClient` in C# and a `Twilio::HTTP::Client` subclass in Ruby.

To run one by hand:

1. Start SendMock with the provider port.

   ```sh
   sendmock --db memory --provider-addr 127.0.0.1:8026
   ```

2. Go to an example, for example the Node SDK.

   ```sh
   cd examples/sms/node-twilio
   ```

3. Install its SDK.

   ```sh
   bun install
   ```

4. Send and verify.

   ```sh
   node send-and-verify.js
   ```

For the Python SDK, after step 1:

1. Go to its folder.

   ```sh
   cd examples/sms/python-twilio
   ```

2. Install its SDK.

   ```sh
   pip install -r requirements.txt
   ```

3. Send and verify.

   ```sh
   python send_and_verify.py
   ```

For the PHP SDK, after step 1:

1. Go to its folder.

   ```sh
   cd examples/sms/php-twilio
   ```

2. Install its SDK.

   ```sh
   composer install
   ```

3. Send and verify.

   ```sh
   php send-and-verify.php
   ```

For the Go SDK, after step 1:

1. Go to its folder.

   ```sh
   cd examples/sms/go-twilio
   ```

2. Send and verify (the first run downloads the SDK).

   ```sh
   go run .
   ```

For the Java SDK, after step 1:

1. Go to its folder.

   ```sh
   cd examples/sms/java-twilio
   ```

2. Send and verify (the first run downloads the SDK).

   ```sh
   mvn compile exec:java
   ```

For the C# SDK, after step 1:

1. Go to its folder.

   ```sh
   cd examples/sms/dotnet-twilio
   ```

2. Send and verify (the first run downloads the SDK).

   ```sh
   dotnet run
   ```

For the Ruby SDK, after step 1:

1. Go to its folder.

   ```sh
   cd examples/sms/ruby-twilio
   ```

2. Install its SDK.

   ```sh
   bundle install
   ```

3. Send and verify.

   ```sh
   bundle exec ruby send_and_verify.rb
   ```

The folders and SDK versions: `node-twilio` (twilio 6.2.0), `python-twilio` (twilio 9.12.0), `php-twilio` (twilio/sdk 8.14.0), `go-twilio` (twilio-go 1.33.0), `java-twilio` (com.twilio.sdk:twilio 13.2.0), `dotnet-twilio` (Twilio 8.2.0) and `ruby-twilio` (twilio-ruby 7.13.0).
