---
title: Two-way SMS
description: Reply as the contact, have your app's webhook receive it in Twilio's format, and see its TwiML answer in the conversation.
---

> Works in your install from Phase 3. Try it in the [demo](/demo/sms) today.

**The situation:** people answer your SMS: STOP to opt out, YES to confirm, or a question to support. Your app has a webhook for incoming SMS and answers with TwiML. You cannot text your laptop.

**You need:** your app's incoming SMS webhook URL, and the number your app sends from.

## Steps

1. In **Numbers**, press **Add number**: your sending number (for example `+15550001111`), **SMS** ticked.
2. Under **Inbound messages**, set **Webhook URL** to your app's handler, **Method** POST and **Format** Twilio. Save.
3. Send an SMS from your app from that number, then open the conversation in **SMS**.
4. In **Reply as recipient**, type `STOP` and press **Send reply**.
5. Your handler gets Twilio's form post (`From`, `To`, `Body`, `MessageSid` and the `X-Twilio-Signature` header). If it answers with TwiML `<Message>`, the answer appears in the conversation with a **TwiML reply** badge.

## In your code

A test that texts STOP to your app's number and waits for your app's answer.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
sendmock sms inbound --from +8801700000000 --to +15550001111 --body STOP

answer=$(sendmock sms wait --to +8801700000000 --from +15550001111 --timeout 10s --json)

jq -e '.direction == "outbound"' <<<"$answer" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('answers STOP', function () {
    Http::post(SENDMOCK.'/sms/inbound', [
        'from' => '+8801700000000',
        'to' => '+15550001111',
        'body' => 'STOP',
    ])->throw();

    $answer = Http::get(SENDMOCK.'/wait/sms', [
        'to' => '+8801700000000',
        'from' => '+15550001111',
        'timeout' => '10s',
    ])->throw()->json();

    expect($answer['direction'])->toBe('outbound');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { call, SENDMOCK } from "./sendmock.js";

test("answers STOP", async () => {
  await call("POST", `${SENDMOCK}/sms/inbound`, { from: "+8801700000000", to: "+15550001111", body: "STOP" });

  const answer = await call("GET", `${SENDMOCK}/wait/sms?to=%2B8801700000000&from=%2B15550001111&timeout=10s`);

  expect(answer.direction).toBe("outbound");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_answers_stop():
    requests.post(
        f"{SENDMOCK}/sms/inbound",
        json={
            "from": "+8801700000000",
            "to": "+15550001111",
            "body": "STOP",
        },
    ).raise_for_status()

    answer = requests.get(
        f"{SENDMOCK}/wait/sms",
        params={
            "to": "+8801700000000",
            "from": "+15550001111",
            "timeout": "10s",
        },
    ).json()

    assert answer["direction"] == "outbound"
```

```go tab="Go"
package app_test

import "testing"

func TestAnswersStop(t *testing.T) {
	call(t, "POST", sendmock+"/sms/inbound", map[string]any{
		"from": "+8801700000000",
		"to":   "+15550001111",
		"body": "STOP",
	})

	answer := call(t, "GET", sendmock+"/wait/sms?to=%2B8801700000000&from=%2B15550001111&timeout=10s", nil).(map[string]any)

	if got := answer["direction"]; got != "outbound" {
		t.Errorf("direction is %v, want %v", got, "outbound")
	}
}
```

```java tab="Java"
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class TwoWaySmsTest {
    @Test
    void answersStop() throws Exception {
        call("POST", SENDMOCK + "/sms/inbound", Map.of(
            "from", "+8801700000000",
            "to", "+15550001111",
            "body", "STOP"
        ));

        var answer = call("GET", SENDMOCK + "/wait/sms?to=%2B8801700000000&from=%2B15550001111&timeout=10s", null);

        assertEquals("outbound", answer.get("direction").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, SENDMOCK};

#[tokio::test]
async fn answers_stop() {
    call("POST", &format!("{SENDMOCK}/sms/inbound"), Some(json!({
        "from": "+8801700000000",
        "to": "+15550001111",
        "body": "STOP"
    }))).await;

    let answer = call("GET", &format!("{SENDMOCK}/wait/sms?to=%2B8801700000000&from=%2B15550001111&timeout=10s"), None).await;

    assert_eq!(answer["direction"], "outbound");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Two way sms" do
  it "answers STOP" do
    call("POST", "#{SENDMOCK}/sms/inbound", {
      "from" => "+8801700000000",
      "to" => "+15550001111",
      "body" => "STOP",
    })

    answer = call("GET", "#{SENDMOCK}/wait/sms?to=%2B8801700000000&from=%2B15550001111&timeout=10s")

    expect(answer["direction"]).to eq("outbound")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class TwoWaySmsTests
{
    [Fact]
    public async Task AnswersStop()
    {
        await Call("POST", Sendmock + "/sms/inbound", new
        {
            from = "+8801700000000",
            to = "+15550001111",
            body = "STOP",
        });

        var answer = await Call("GET", Sendmock + "/wait/sms?to=%2B8801700000000&from=%2B15550001111&timeout=10s");

        Assert.Equal("outbound", answer.GetProperty("direction").GetString());
    }
}
```

## What you should see

Under the STOP bubble, "Reply webhook 200" (and "1 TwiML reply" if your app answered). **Message details > Reply webhook** shows the request, your app's response and the parsed TwiML. If your handler failed, **Resend reply webhook** sends it again after your fix.

## Try it in the demo

1. Open [SMS](/demo/sms) and click the conversation with `+8801700000000`.
2. Type `Is the shop open?` in **Reply as recipient** and press **Send reply**.
3. The demo's app answers with TwiML: "Thanks! We got your message and will get back to you soon." appears with a **TwiML reply** badge.

## Next

- [Replies and WhatsApp](../sms/replies-and-whatsapp.md)
- [Advanced: numbers and Messaging Services](../advanced/numbers-and-services.md)
