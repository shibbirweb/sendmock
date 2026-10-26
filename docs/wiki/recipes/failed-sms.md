---
title: Failed SMS
description: Make SMS fail with Twilio's real error codes, at send time or after, and check how your app handles it.
---

> Works in your install from Phase 2. Try it in the [demo](/demo/settings?section=sms) today.

**The situation:** your app should handle an SMS that cannot be sent (invalid number, opted out) and one that is accepted but never arrives (unreachable handset, carrier filter). On Twilio these are hard to produce on demand.

**You need:** your app's SMS client pointing at SendMock (`http://127.0.0.1:8026` for Twilio SDKs, or the native API). See [Connect your app](../connect/index.md).

## Steps

1. **Fail at send time.** Send from your app to `+15005550001`. SendMock answers at once with HTTP 400 and Twilio's error JSON, code `21211` (invalid number), exactly as Twilio's test credentials do. Your app should show its error.
2. **Fail after sending.** Send to `+15005550103`. The message is accepted, then turns **undelivered** with `30007` (filtered by the carrier), and your status callback is called with it.
3. Open the conversation in **SMS**: the failed message shows a red tick with the code on hover; **Message details** shows the status history and each callback attempt.

Other numbers and codes are on [Delivery and test numbers](../sms/delivery-and-test-numbers.md).

## With cURL

```bash
curl -s http://127.0.0.1:8025/api/v1/sms \
  -H 'content-type: application/json' \
  -d '{"from": "+15550001111", "to": "+15005550001", "body": "Hi"}'
# 400: Rejected with error 21211 (magic number)
```

## In your code

A test that marks a sent SMS undelivered with Twilio's `30007`, so your status callback handler runs. Sending to `+15005550103` does the same by itself.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
# In your app: text the order update to +8801700000000

sms=$(sendmock sms wait --to +8801700000000 --timeout 10s --json)

failed=$(sendmock sms status "$(jq -r '.id' <<<"$sms")" undelivered --error-code 30007 --json)

jq -e '.status == "undelivered"' <<<"$failed" >/dev/null
jq -e '.error_code == "30007"' <<<"$failed" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('handles an undelivered SMS', function () {
    $this->post('/orders/42/notify');

    $sms = Http::get(SENDMOCK.'/wait/sms', [
        'to' => '+8801700000000',
        'timeout' => '10s',
    ])->throw()->json();

    $failed = Http::post(SENDMOCK."/sms/{$sms['id']}/status", [
        'status' => 'undelivered',
        'error_code' => '30007',
    ])->throw()->json();

    expect($failed['status'])->toBe('undelivered');
    expect($failed['error_code'])->toBe('30007');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { APP, call, SENDMOCK } from "./sendmock.js";

test("handles an undelivered SMS", async () => {
  await call("POST", `${APP}/orders/42/notify`);

  const sms = await call("GET", `${SENDMOCK}/wait/sms?to=%2B8801700000000&timeout=10s`);

  const failed = await call("POST", `${SENDMOCK}/sms/${sms.id}/status`, { status: "undelivered", error_code: "30007" });

  expect(failed.status).toBe("undelivered");
  expect(failed.error_code).toBe("30007");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_handles_an_undelivered_sms():
    requests.post(f"{APP}/orders/42/notify")

    sms = requests.get(
        f"{SENDMOCK}/wait/sms",
        params={"to": "+8801700000000", "timeout": "10s"},
    ).json()

    failed = requests.post(
        f"{SENDMOCK}/sms/{sms['id']}/status",
        json={"status": "undelivered", "error_code": "30007"},
    ).json()

    assert failed["status"] == "undelivered"
    assert failed["error_code"] == "30007"
```

```go tab="Go"
package app_test

import "testing"

func TestHandlesAnUndeliveredSms(t *testing.T) {
	call(t, "POST", app+"/orders/42/notify", nil)

	sms := call(t, "GET", sendmock+"/wait/sms?to=%2B8801700000000&timeout=10s", nil).(map[string]any)

	failed := call(t, "POST", sendmock+"/sms/"+sms["id"].(string)+"/status", map[string]any{
		"status":     "undelivered",
		"error_code": "30007",
	}).(map[string]any)

	if got := failed["status"]; got != "undelivered" {
		t.Errorf("status is %v, want %v", got, "undelivered")
	}
	if got := failed["error_code"]; got != "30007" {
		t.Errorf("error_code is %v, want %v", got, "30007")
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

class FailedSmsTest {
    @Test
    void handlesAnUndeliveredSms() throws Exception {
        call("POST", APP + "/orders/42/notify", null);

        var sms = call("GET", SENDMOCK + "/wait/sms?to=%2B8801700000000&timeout=10s", null);

        var failed = call("POST", SENDMOCK + "/sms/" + sms.get("id").asText() + "/status", Map.of("status", "undelivered", "error_code", "30007"));

        assertEquals("undelivered", failed.get("status").asText());
        assertEquals("30007", failed.get("error_code").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, APP, SENDMOCK};

#[tokio::test]
async fn handles_an_undelivered_sms() {
    call("POST", &format!("{APP}/orders/42/notify"), None).await;

    let sms = call("GET", &format!("{SENDMOCK}/wait/sms?to=%2B8801700000000&timeout=10s"), None).await;

    let failed = call("POST", &format!("{SENDMOCK}/sms/{}/status", sms["id"].as_str().unwrap()), Some(json!({"status": "undelivered", "error_code": "30007"}))).await;

    assert_eq!(failed["status"], "undelivered");
    assert_eq!(failed["error_code"], "30007");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Failed sms" do
  it "handles an undelivered SMS" do
    call("POST", "#{APP}/orders/42/notify")

    sms = call("GET", "#{SENDMOCK}/wait/sms?to=%2B8801700000000&timeout=10s")

    failed = call("POST", "#{SENDMOCK}/sms/#{sms["id"]}/status", { "status" => "undelivered", "error_code" => "30007" })

    expect(failed["status"]).to eq("undelivered")
    expect(failed["error_code"]).to eq("30007")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class FailedSmsTests
{
    [Fact]
    public async Task HandlesAnUndeliveredSms()
    {
        await Call("POST", App + "/orders/42/notify");

        var sms = await Call("GET", Sendmock + "/wait/sms?to=%2B8801700000000&timeout=10s");

        var failed = await Call("POST", Sendmock + "/sms/" + sms.GetProperty("id").GetString() + "/status", new { status = "undelivered", error_code = "30007" });

        Assert.Equal("undelivered", failed.GetProperty("status").GetString());
        Assert.Equal("30007", failed.GetProperty("error_code").GetString());
    }
}
```

## What you should see

The 400 with code 21211 in your app's logs for the first send; for the second, an undelivered message and your callback handler receiving `30007`.

## Try it in the demo

1. Open [Settings > SMS](/demo/settings?section=sms).
2. Type `+15005550001` in **Test a number**: it says "Magic number: Invalid number (21211)".
3. Type `+15559990000`: a custom rule applies, "Accepted, then undelivered, 30007".

## Next

- [Advanced: SMS outcome numbers](../advanced/sms-outcome-numbers.md): your own failing numbers.
- [Delivery and test numbers](../sms/delivery-and-test-numbers.md)
