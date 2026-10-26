---
title: Inbound email
description: Receive email in your app the way Postmark, SendGrid or Mailgun posts it, with a built-in template and a rule.
---

> Works in your install from Phase 3 (native and Twilio formats) and Phase 4 (email provider formats). Try it in the [demo](/demo/webhooks/templates) today.

**The situation:** your app receives email through a provider's inbound webhook: support tickets from `support@`, invoices from a mailbox, replies. You want to test the handler with the provider's real payload, without a public URL.

**You need:** your app's inbound handler URL, for example `http://localhost:8000/webhooks/postmark-inbound`.

## Steps

1. In **Webhooks > Templates**, open the **Email providers** tab and click **Postmark: inbound** (or SendGrid Inbound Parse, or Mailgun routes).
2. Press **Use in new endpoint**. The endpoint sheet opens with the template chosen. Name it "Postmark inbound", set your handler's URL and press **Add endpoint**.
3. In **Webhooks > Rules**, press **Add rule**. Name it "Support inbox", pick the endpoint, tick `email.received`, and add a condition **To** **matches** `support@*`. Press **Add rule**.
4. Send an email to `support@yourapp.test` (from your app, or with any mail client pointed at `127.0.0.1:1025`).

## In your code

A test that sends an email to the support inbox and checks it was posted to your inbound handler in Postmark's format.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
sendmock email send --from 'Sam <sam@customer.test>' --to support@yourapp.test --subject 'Order arrived damaged' --text 'The box was crushed, can I get a replacement?'

delivery=$(sendmock webhook deliveries wait --endpoint 'Postmark inbound' --event email.received --timeout 10s --json)

jq -e '.status == "succeeded"' <<<"$delivery" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('posts a support email to the inbound handler', function () {
    Http::post(SENDMOCK.'/send', [
        'from' => 'Sam <sam@customer.test>',
        'to' => ['support@yourapp.test'],
        'subject' => 'Order arrived damaged',
        'text' => 'The box was crushed, can I get a replacement?',
    ])->throw();

    $delivery = Http::get(SENDMOCK.'/wait/webhook', [
        'endpoint' => 'Postmark inbound',
        'event' => 'email.received',
        'timeout' => '10s',
    ])->throw()->json();

    expect($delivery['status'])->toBe('succeeded');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { call, SENDMOCK } from "./sendmock.js";

test("posts a support email to the inbound handler", async () => {
  await call("POST", `${SENDMOCK}/send`, {
    from: "Sam <sam@customer.test>",
    to: ["support@yourapp.test"],
    subject: "Order arrived damaged",
    text: "The box was crushed, can I get a replacement?",
  });

  const delivery = await call("GET", `${SENDMOCK}/wait/webhook?endpoint=Postmark%20inbound&event=email.received&timeout=10s`);

  expect(delivery.status).toBe("succeeded");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_posts_a_support_email_to_the_inbound_handler():
    requests.post(
        f"{SENDMOCK}/send",
        json={
            "from": "Sam <sam@customer.test>",
            "to": ["support@yourapp.test"],
            "subject": "Order arrived damaged",
            "text": "The box was crushed, can I get a replacement?",
        },
    ).raise_for_status()

    delivery = requests.get(
        f"{SENDMOCK}/wait/webhook",
        params={
            "endpoint": "Postmark inbound",
            "event": "email.received",
            "timeout": "10s",
        },
    ).json()

    assert delivery["status"] == "succeeded"
```

```go tab="Go"
package app_test

import "testing"

func TestPostsASupportEmailToTheInboundHandler(t *testing.T) {
	call(t, "POST", sendmock+"/send", map[string]any{
		"from":    "Sam <sam@customer.test>",
		"to":      []any{"support@yourapp.test"},
		"subject": "Order arrived damaged",
		"text":    "The box was crushed, can I get a replacement?",
	})

	delivery := call(t, "GET", sendmock+"/wait/webhook?endpoint=Postmark%20inbound&event=email.received&timeout=10s", nil).(map[string]any)

	if got := delivery["status"]; got != "succeeded" {
		t.Errorf("status is %v, want %v", got, "succeeded")
	}
}
```

```java tab="Java"
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class InboundEmailTest {
    @Test
    void postsASupportEmailToTheInboundHandler() throws Exception {
        call("POST", SENDMOCK + "/send", Map.of(
            "from", "Sam <sam@customer.test>",
            "to", List.of("support@yourapp.test"),
            "subject", "Order arrived damaged",
            "text", "The box was crushed, can I get a replacement?"
        ));

        var delivery = call("GET", SENDMOCK + "/wait/webhook?endpoint=Postmark%20inbound&event=email.received&timeout=10s", null);

        assertEquals("succeeded", delivery.get("status").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, SENDMOCK};

#[tokio::test]
async fn posts_a_support_email_to_the_inbound_handler() {
    call("POST", &format!("{SENDMOCK}/send"), Some(json!({
        "from": "Sam <sam@customer.test>",
        "to": ["support@yourapp.test"],
        "subject": "Order arrived damaged",
        "text": "The box was crushed, can I get a replacement?"
    }))).await;

    let delivery = call("GET", &format!("{SENDMOCK}/wait/webhook?endpoint=Postmark%20inbound&event=email.received&timeout=10s"), None).await;

    assert_eq!(delivery["status"], "succeeded");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Inbound email" do
  it "posts a support email to the inbound handler" do
    call("POST", "#{SENDMOCK}/send", {
      "from" => "Sam <sam@customer.test>",
      "to" => ["support@yourapp.test"],
      "subject" => "Order arrived damaged",
      "text" => "The box was crushed, can I get a replacement?",
    })

    delivery = call("GET", "#{SENDMOCK}/wait/webhook?endpoint=Postmark%20inbound&event=email.received&timeout=10s")

    expect(delivery["status"]).to eq("succeeded")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class InboundEmailTests
{
    [Fact]
    public async Task PostsASupportEmailToTheInboundHandler()
    {
        await Call("POST", Sendmock + "/send", new
        {
            from = "Sam <sam@customer.test>",
            to = new[] { "support@yourapp.test" },
            subject = "Order arrived damaged",
            text = "The box was crushed, can I get a replacement?",
        });

        var delivery = await Call("GET", Sendmock + "/wait/webhook?endpoint=Postmark%20inbound&event=email.received&timeout=10s");

        Assert.Equal("succeeded", delivery.GetProperty("status").GetString());
    }
}
```

## What you should see

A delivery in **Webhooks > Deliveries** whose request body is Postmark's inbound JSON (`From`, `To`, `Subject`, `TextBody`, `HtmlBody`, `Attachments`, ...), and your app's answer beside it. Your app created the ticket.

## Try it in the demo

1. Open [Webhooks > Templates](/demo/webhooks/templates), the **Email providers** tab, and click **Postmark: inbound**.
2. Press **Use in new endpoint**. Name it `Postmark inbound`, set the URL to `http://localhost:8000/webhooks/postmark-inbound` and press **Add endpoint**.
3. The endpoint appears in **Endpoints** with the Postmark template.

## Next

- [Templates](../webhooks/templates.md)
- [Rules](../webhooks/rules.md)
