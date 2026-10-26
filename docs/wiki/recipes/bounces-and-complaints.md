---
title: Bounces and complaints
description: Make an email bounce or be marked as spam, by hand or with a magic address, and send the event to your app in your provider's format.
---

> Works in your install from Phase 3 (native events) and Phase 4 (provider formats). Try it in the [demo](/demo/mail) today.

**The situation:** your app should stop emailing addresses that bounce and people who mark it as spam, and maybe show "email bounced" to an admin. Real bounces are hard to produce, so this code is rarely tested.

**You need:** your app's mail settings pointing at SendMock, and your app's bounce webhook handler URL.

## Steps

1. **Send the event to your app.** In **Webhooks > Endpoints**, press **Add endpoint**, set your handler's URL, and in **Request** pick your provider's event template (for example "SendGrid: Event Webhook"). Then in **Webhooks > Rules**, add a rule for that endpoint with the events `email.bounced` and `email.complained`.
2. **Bounce by address.** In your app, send an email to `bounce@example.test`. It hard bounces by itself (`550 5.1.1 user unknown`). `complaint@example.test` is delivered and then marked as spam.
3. **Or bounce by hand.** Open any email in **Mail**, press **Simulate** and pick **Hard bounce**, **Soft bounce** or **Spam complaint**.
4. Open **Webhooks > Deliveries**: the event was posted to your handler, and your app's answer is there.

## Which addresses do what

`delivered@`, `bounce@`, `bounce+hard@`, `bounce+soft@` and `complaint@` work on any domain; the Amazon SES simulator addresses work too. The full table is on [Outcomes](../mail/outcomes.md). **Test an address** in **Settings > Email** tells you what an address will do.

## In your code

A test that makes an invitation bounce and checks the bounce reached your app's webhook.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
# In your app: invite sam@example.test

email=$(sendmock email wait --to sam@example.test --timeout 10s --json)

sendmock email simulate "$(jq -r '.id' <<<"$email")" bounced --bounce-type hard

delivery=$(sendmock webhook deliveries wait --event email.bounced --timeout 10s --json)

jq -e '.status == "succeeded"' <<<"$delivery" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('handles a hard bounce', function () {
    $this->post('/invitations', ['email' => 'sam@example.test']);

    $email = Http::get(SENDMOCK.'/wait/email', [
        'to' => 'sam@example.test',
        'timeout' => '10s',
    ])->throw()->json();

    Http::post(SENDMOCK."/emails/{$email['id']}/simulate", [
        'event' => 'bounced',
        'bounce_type' => 'hard',
    ])->throw();

    $delivery = Http::get(SENDMOCK.'/wait/webhook', [
        'event' => 'email.bounced',
        'timeout' => '10s',
    ])->throw()->json();

    expect($delivery['status'])->toBe('succeeded');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { APP, call, SENDMOCK } from "./sendmock.js";

test("handles a hard bounce", async () => {
  await call("POST", `${APP}/invitations`, { email: "sam@example.test" });

  const email = await call("GET", `${SENDMOCK}/wait/email?to=sam%40example.test&timeout=10s`);

  await call("POST", `${SENDMOCK}/emails/${email.id}/simulate`, { event: "bounced", bounce_type: "hard" });

  const delivery = await call("GET", `${SENDMOCK}/wait/webhook?event=email.bounced&timeout=10s`);

  expect(delivery.status).toBe("succeeded");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_handles_a_hard_bounce():
    requests.post(f"{APP}/invitations", json={"email": "sam@example.test"})

    email = requests.get(
        f"{SENDMOCK}/wait/email",
        params={"to": "sam@example.test", "timeout": "10s"},
    ).json()

    requests.post(
        f"{SENDMOCK}/emails/{email['id']}/simulate",
        json={"event": "bounced", "bounce_type": "hard"},
    ).raise_for_status()

    delivery = requests.get(
        f"{SENDMOCK}/wait/webhook",
        params={"event": "email.bounced", "timeout": "10s"},
    ).json()

    assert delivery["status"] == "succeeded"
```

```go tab="Go"
package app_test

import "testing"

func TestHandlesAHardBounce(t *testing.T) {
	call(t, "POST", app+"/invitations", map[string]any{"email": "sam@example.test"})

	email := call(t, "GET", sendmock+"/wait/email?to=sam%40example.test&timeout=10s", nil).(map[string]any)

	call(t, "POST", sendmock+"/emails/"+email["id"].(string)+"/simulate", map[string]any{"event": "bounced", "bounce_type": "hard"})

	delivery := call(t, "GET", sendmock+"/wait/webhook?event=email.bounced&timeout=10s", nil).(map[string]any)

	if got := delivery["status"]; got != "succeeded" {
		t.Errorf("status is %v, want %v", got, "succeeded")
	}
}
```

```java tab="Java"
import static app.SendMock.APP;
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class BouncesAndComplaintsTest {
    @Test
    void handlesAHardBounce() throws Exception {
        call("POST", APP + "/invitations", Map.of("email", "sam@example.test"));

        var email = call("GET", SENDMOCK + "/wait/email?to=sam%40example.test&timeout=10s", null);

        call("POST", SENDMOCK + "/emails/" + email.get("id").asText() + "/simulate", Map.of("event", "bounced", "bounce_type", "hard"));

        var delivery = call("GET", SENDMOCK + "/wait/webhook?event=email.bounced&timeout=10s", null);

        assertEquals("succeeded", delivery.get("status").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, APP, SENDMOCK};

#[tokio::test]
async fn handles_a_hard_bounce() {
    call("POST", &format!("{APP}/invitations"), Some(json!({"email": "sam@example.test"}))).await;

    let email = call("GET", &format!("{SENDMOCK}/wait/email?to=sam%40example.test&timeout=10s"), None).await;

    call("POST", &format!("{SENDMOCK}/emails/{}/simulate", email["id"].as_str().unwrap()), Some(json!({"event": "bounced", "bounce_type": "hard"}))).await;

    let delivery = call("GET", &format!("{SENDMOCK}/wait/webhook?event=email.bounced&timeout=10s"), None).await;

    assert_eq!(delivery["status"], "succeeded");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Bounces and complaints" do
  it "handles a hard bounce" do
    call("POST", "#{APP}/invitations", { "email" => "sam@example.test" })

    email = call("GET", "#{SENDMOCK}/wait/email?to=sam%40example.test&timeout=10s")

    call("POST", "#{SENDMOCK}/emails/#{email["id"]}/simulate", { "event" => "bounced", "bounce_type" => "hard" })

    delivery = call("GET", "#{SENDMOCK}/wait/webhook?event=email.bounced&timeout=10s")

    expect(delivery["status"]).to eq("succeeded")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class BouncesAndComplaintsTests
{
    [Fact]
    public async Task HandlesAHardBounce()
    {
        await Call("POST", App + "/invitations", new { email = "sam@example.test" });

        var email = await Call("GET", Sendmock + "/wait/email?to=sam%40example.test&timeout=10s");

        await Call("POST", Sendmock + "/emails/" + email.GetProperty("id").GetString() + "/simulate", new { @event = "bounced", bounce_type = "hard" });

        var delivery = await Call("GET", Sendmock + "/wait/webhook?event=email.bounced&timeout=10s");

        Assert.Equal("succeeded", delivery.GetProperty("status").GetString());
    }
}
```

## What you should see

The email with a Bounced or Complained badge and a **Timeline** entry, a delivery in **Deliveries**, and your app marking the address as suppressed.

## Try it in the demo

1. In [Settings > Email](/demo/settings?section=email), type `bounce+hard@shop.test` in **Test an address**: it says "Magic address: Hard bounce (550 5.1.1)".
2. Open [Mail](/demo/mail), click **Reset your password**, press **Simulate** and pick **Hard bounce**.
3. The **Timeline** tab lists the bounce.

## Next

- [Advanced: email outcome addresses](../advanced/email-outcome-addresses.md): your own addresses that always bounce.
- [Outcomes](../mail/outcomes.md)
