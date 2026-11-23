---
title: SDKs without a base URL setting
description: Point the Twilio PHP, Node and Python SDKs and the Mailgun PHP and Node SDKs at SendMock, even where the SDK has no base URL option, with the code CI runs.
---

Some SDKs always call the real provider's host and have no setting to change it. Each one still lets you give it your own HTTP client, and that client can send every request to SendMock's provider port instead, keeping the path and query. The snippets below are the ones SendMock's CI runs against a real SendMock (see `examples/sms` and `examples/email-providers` in the repository).

Start SendMock first; the provider port is on by default at `http://127.0.0.1:8026`.

## Twilio PHP

1. Give the client a `CurlClient` that rewrites the host.

   ```php
   use Twilio\AuthStrategy\AuthStrategy;
   use Twilio\Http\CurlClient;
   use Twilio\Http\Response;
   use Twilio\Rest\Client;

   final class SendMockCurlClient extends CurlClient
   {
       public function __construct(private readonly string $providerUrl)
       {
           parent::__construct();
       }

       public function request(string $method, string $url, array $params = [], array $data = [], array $headers = [], ?string $user = null, ?string $password = null, ?int $timeout = null, ?AuthStrategy $authStrategy = null): Response
       {
           $twilioUrl = parse_url($url);
           $pathAndQuery = ($twilioUrl['path'] ?? '/') . (isset($twilioUrl['query']) ? '?' . $twilioUrl['query'] : '');

           return parent::request($method, rtrim($this->providerUrl, '/') . $pathAndQuery, $params, $data, $headers, $user, $password, $timeout, $authStrategy);
       }
   }

   $twilio = new Client($accountSid, $authToken, null, null, new SendMockCurlClient('http://127.0.0.1:8026'));
   ```

## Twilio Node

1. Give the client a `RequestClient` that rewrites the host.

   ```javascript
   import twilio from "twilio";

   class SendMockRequestClient extends twilio.RequestClient {
     request(requestOptions) {
       const twilioUrl = new URL(requestOptions.uri);
       const sendmockUrl = new URL(`${twilioUrl.pathname}${twilioUrl.search}`, "http://127.0.0.1:8026");
       return super.request({ ...requestOptions, uri: sendmockUrl.href });
     }
   }

   const client = twilio(accountSid, authToken, { httpClient: new SendMockRequestClient() });
   ```

## Twilio Python

1. Give the client a `TwilioHttpClient` that rewrites the host.

   ```python
   import urllib.parse

   from twilio.http.http_client import TwilioHttpClient
   from twilio.rest import Client

   class SendMockHttpClient(TwilioHttpClient):
       def request(self, method, url, *args, **kwargs):
           twilio_url = urllib.parse.urlsplit(url)
           local_url = urllib.parse.urljoin(
               "http://127.0.0.1:8026",
               urllib.parse.urlunsplit(("", "", twilio_url.path, twilio_url.query, "")),
           )
           return super().request(method, local_url, *args, **kwargs)

   client = Client(account_sid, auth_token, http_client=SendMockHttpClient())
   ```

## Mailgun PHP

1. Pass the provider port as the endpoint, the SDK's second argument.

   ```php
   use Mailgun\Mailgun;

   $mailgun = Mailgun::create('key-sendmock-example', 'http://127.0.0.1:8026');
   ```

Laravel's `mailgun` mailer only speaks HTTPS: use the HTTPS provider port and `sendmock trust`, as [HTTPS for provider SDKs](./https.md) shows.

## Mailgun Node

1. Pass the provider port as `url`.

   ```javascript
   import Mailgun from "mailgun.js";

   const mailgun = new Mailgun(FormData).client({ username: "api", key: "key-sendmock-example", url: "http://127.0.0.1:8026" });
   ```

## Check it

1. Send one message with your app, then list what SendMock caught.

   ```bash
   sendmock sms list
   ```

2. For email:

   ```bash
   sendmock email list
   ```

The demo has no provider port, but SMS > Providers > Twilio and Mail > Providers > Mailgun show each provider's base URLs under **Try it**, with a `curl` command that sends the same request these clients send.
