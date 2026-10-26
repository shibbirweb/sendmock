---
title: Twilio Verify login
description: Log in with a Twilio Verify code, then test an expired code, a canceled verification and too many attempts.
---

> Works in your install from Phase 2. Try it in the [demo](/demo/sms/verify) today.

**The situation:** your app logs people in, or confirms phone numbers, with Twilio Verify. The happy path is easy; an expired code or too many wrong tries are not.

**You need:** your app's Twilio client pointing at `http://127.0.0.1:8026`. The Verify service SID your app uses can be created in **SMS > Verify > Services** (or the seed file).

## Steps

1. In your app, start a login with a phone number. A row appears in **SMS > Verify** with the code and "Expires in ..." counting down. The code also arrives as an SMS in **SMS**.
2. Copy the code and enter it in your app. The row turns **Approved** and your app logs in.
3. Start another login. Open the row and press **Expire**. Enter the old code in your app: the check fails as Twilio fails it.
4. Start another and press **Max attempts**, or enter wrong codes until the attempt limit. Your app should stop accepting codes.

## For automated tests

Give the service a **fixed code**: in **Services**, edit it and set **Fixed code (optional)** to `123456`. Every verification then uses that code, so your tests can type it without reading anything.

## In your code

A test that starts a login, expires the code and checks your app refuses it.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
# In your app: start a login for +8801700000000

pending=$(sendmock verify list --to +8801700000000 --status pending --limit 1 --json)

verification=$(jq '.items[0]' <<<"$pending")

expired=$(sendmock verify force "$(jq -r '.sid' <<<"$verification")" expired --json)

# In your app: enter the old code; your app should refuse it

jq -e '.status == "expired"' <<<"$expired" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('refuses an expired code', function () {
    $this->post('/login', ['phone' => '+8801700000000']);

    $pending = Http::get(SENDMOCK.'/verify', [
        'to' => '+8801700000000',
        'status' => 'pending',
        'limit' => '1',
    ])->throw()->json();

    $verification = $pending['items'][0];

    $expired = Http::post(SENDMOCK."/verify/{$verification['sid']}/force", ['state' => 'expired'])->throw()->json();

    $this->post('/login/verify', ['code' => $verification['code']]);

    expect($expired['status'])->toBe('expired');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { APP, call, SENDMOCK } from "./sendmock.js";

test("refuses an expired code", async () => {
  await call("POST", `${APP}/login`, { phone: "+8801700000000" });

  const pending = await call("GET", `${SENDMOCK}/verify?to=%2B8801700000000&status=pending&limit=1`);

  const verification = pending.items[0];

  const expired = await call("POST", `${SENDMOCK}/verify/${verification.sid}/force`, { state: "expired" });

  await call("POST", `${APP}/login/verify`, { code: verification.code });

  expect(expired.status).toBe("expired");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_refuses_an_expired_code():
    requests.post(f"{APP}/login", json={"phone": "+8801700000000"})

    pending = requests.get(
        f"{SENDMOCK}/verify",
        params={"to": "+8801700000000", "status": "pending", "limit": "1"},
    ).json()

    verification = pending["items"][0]

    expired = requests.post(
        f"{SENDMOCK}/verify/{verification['sid']}/force",
        json={"state": "expired"},
    ).json()

    requests.post(f"{APP}/login/verify", json={"code": verification["code"]})

    assert expired["status"] == "expired"
```

```go tab="Go"
package app_test

import "testing"

func TestRefusesAnExpiredCode(t *testing.T) {
	call(t, "POST", app+"/login", map[string]any{"phone": "+8801700000000"})

	pending := call(t, "GET", sendmock+"/verify?to=%2B8801700000000&status=pending&limit=1", nil).(map[string]any)

	verification := pending["items"].([]any)[0].(map[string]any)

	expired := call(t, "POST", sendmock+"/verify/"+verification["sid"].(string)+"/force", map[string]any{"state": "expired"}).(map[string]any)

	call(t, "POST", app+"/login/verify", map[string]any{"code": verification["code"]})

	if got := expired["status"]; got != "expired" {
		t.Errorf("status is %v, want %v", got, "expired")
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

class TwilioVerifyLoginTest {
    @Test
    void refusesAnExpiredCode() throws Exception {
        call("POST", APP + "/login", Map.of("phone", "+8801700000000"));

        var pending = call("GET", SENDMOCK + "/verify?to=%2B8801700000000&status=pending&limit=1", null);

        var verification = pending.get("items").get(0);

        var expired = call("POST", SENDMOCK + "/verify/" + verification.get("sid").asText() + "/force", Map.of("state", "expired"));

        call("POST", APP + "/login/verify", Map.of("code", verification.get("code")));

        assertEquals("expired", expired.get("status").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, APP, SENDMOCK};

#[tokio::test]
async fn refuses_an_expired_code() {
    call("POST", &format!("{APP}/login"), Some(json!({"phone": "+8801700000000"}))).await;

    let pending = call("GET", &format!("{SENDMOCK}/verify?to=%2B8801700000000&status=pending&limit=1"), None).await;

    let verification = &pending["items"][0];

    let expired = call("POST", &format!("{SENDMOCK}/verify/{}/force", verification["sid"].as_str().unwrap()), Some(json!({"state": "expired"}))).await;

    call("POST", &format!("{APP}/login/verify"), Some(json!({"code": verification["code"].clone()}))).await;

    assert_eq!(expired["status"], "expired");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Twilio verify login" do
  it "refuses an expired code" do
    call("POST", "#{APP}/login", { "phone" => "+8801700000000" })

    pending = call("GET", "#{SENDMOCK}/verify?to=%2B8801700000000&status=pending&limit=1")

    verification = pending["items"][0]

    expired = call("POST", "#{SENDMOCK}/verify/#{verification["sid"]}/force", { "state" => "expired" })

    call("POST", "#{APP}/login/verify", { "code" => verification["code"] })

    expect(expired["status"]).to eq("expired")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class TwilioVerifyLoginTests
{
    [Fact]
    public async Task RefusesAnExpiredCode()
    {
        await Call("POST", App + "/login", new { phone = "+8801700000000" });

        var pending = await Call("GET", Sendmock + "/verify?to=%2B8801700000000&status=pending&limit=1");

        var verification = pending.GetProperty("items")[0];

        var expired = await Call("POST", Sendmock + "/verify/" + verification.GetProperty("sid").GetString() + "/force", new { state = "expired" });

        await Call("POST", App + "/login/verify", new { code = verification.GetProperty("code") });

        Assert.Equal("expired", expired.GetProperty("status").GetString());
    }
}
```

## What you should see

Approved, expired and max-attempts rows in Verify, each with its timeline, and your app's matching messages.

## Try it in the demo

1. Open [SMS > Verify](/demo/sms/verify) and click a **Pending** verification.
2. In the drawer, press **Expire**. The status changes to **Expired** and the timeline records it.

## Next

- [Verify](../sms/verify.md)
- [Read a one-time code](./read-a-code.md)
