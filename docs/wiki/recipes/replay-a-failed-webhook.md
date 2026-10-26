---
title: Replay a failed webhook
description: Find a failed delivery, read what your handler got and answered, fix it, and send the same request again.
---

> Works in your install from Phase 3. Try it in the [demo](/demo/webhooks/deliveries) today.

**The situation:** a webhook handler in your app returned 500 (or timed out). You want to see exactly what it received, fix it, and try again without making the event happen again.

**You need:** nothing beyond an endpoint that received a delivery.

## Steps

1. Notice it: the bell shows a failed delivery, the **Overview** lists it under **Recent failures**, or open **Webhooks > Deliveries** and press **Failed**.
2. Open the delivery. The request (method, URL, headers, body) is on the left and your app's response on the right. **Attempts** lists every retry.
3. Fix your handler. If the delivery is still retrying, you can wait for the next attempt, or press **Cancel retries**.
4. Press **Replay** > **Replay as-is**. A new delivery is sent with the same request.
5. To test a variation, press **Edit and replay**, change the body, and **Send edited request**.

## Keep it for next time

Press **Save** and name it ("Order webhook with null address"). It is now in **Webhooks > Saved**, ready to **Send** after every change, and it goes into the seed file.

## With the CLI

```bash
sendmock webhook deliveries list --failed
sendmock webhook deliveries replay <deliveryId>
```

## In your code

A script that finds the newest failed delivery and sends the same request again after you fixed the handler.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
failures=$(sendmock webhook deliveries list --status failed --limit 1 --json)

failure=$(jq '.items[0]' <<<"$failures")

replay=$(sendmock webhook deliveries replay "$(jq -r '.id' <<<"$failure")" --no-rerender --json)

jq -e '.trigger == "replay"' <<<"$replay" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('replays the newest failed delivery', function () {
    $failures = Http::get(SENDMOCK.'/webhooks/deliveries', [
        'status' => 'failed',
        'limit' => '1',
    ])->throw()->json();

    $failure = $failures['items'][0];

    $replay = Http::post(SENDMOCK."/webhooks/deliveries/{$failure['id']}/replay", ['rerender' => false])->throw()->json();

    expect($replay['trigger'])->toBe('replay');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { call, SENDMOCK } from "./sendmock.js";

test("replays the newest failed delivery", async () => {
  const failures = await call("GET", `${SENDMOCK}/webhooks/deliveries?status=failed&limit=1`);

  const failure = failures.items[0];

  const replay = await call("POST", `${SENDMOCK}/webhooks/deliveries/${failure.id}/replay`, { rerender: false });

  expect(replay.trigger).toBe("replay");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_replays_the_newest_failed_delivery():
    failures = requests.get(
        f"{SENDMOCK}/webhooks/deliveries",
        params={"status": "failed", "limit": "1"},
    ).json()

    failure = failures["items"][0]

    replay = requests.post(
        f"{SENDMOCK}/webhooks/deliveries/{failure['id']}/replay",
        json={"rerender": False},
    ).json()

    assert replay["trigger"] == "replay"
```

```go tab="Go"
package app_test

import "testing"

func TestReplaysTheNewestFailedDelivery(t *testing.T) {
	failures := call(t, "GET", sendmock+"/webhooks/deliveries?status=failed&limit=1", nil).(map[string]any)

	failure := failures["items"].([]any)[0].(map[string]any)

	replay := call(t, "POST", sendmock+"/webhooks/deliveries/"+failure["id"].(string)+"/replay", map[string]any{"rerender": false}).(map[string]any)

	if got := replay["trigger"]; got != "replay" {
		t.Errorf("trigger is %v, want %v", got, "replay")
	}
}
```

```java tab="Java"
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class ReplayAFailedWebhookTest {
    @Test
    void replaysTheNewestFailedDelivery() throws Exception {
        var failures = call("GET", SENDMOCK + "/webhooks/deliveries?status=failed&limit=1", null);

        var failure = failures.get("items").get(0);

        var replay = call("POST", SENDMOCK + "/webhooks/deliveries/" + failure.get("id").asText() + "/replay", Map.of("rerender", false));

        assertEquals("replay", replay.get("trigger").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, SENDMOCK};

#[tokio::test]
async fn replays_the_newest_failed_delivery() {
    let failures = call("GET", &format!("{SENDMOCK}/webhooks/deliveries?status=failed&limit=1"), None).await;

    let failure = &failures["items"][0];

    let replay = call("POST", &format!("{SENDMOCK}/webhooks/deliveries/{}/replay", failure["id"].as_str().unwrap()), Some(json!({"rerender": false}))).await;

    assert_eq!(replay["trigger"], "replay");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Replay a failed webhook" do
  it "replays the newest failed delivery" do
    failures = call("GET", "#{SENDMOCK}/webhooks/deliveries?status=failed&limit=1")

    failure = failures["items"][0]

    replay = call("POST", "#{SENDMOCK}/webhooks/deliveries/#{failure["id"]}/replay", { "rerender" => false })

    expect(replay["trigger"]).to eq("replay")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class ReplayAFailedWebhookTests
{
    [Fact]
    public async Task ReplaysTheNewestFailedDelivery()
    {
        var failures = await Call("GET", Sendmock + "/webhooks/deliveries?status=failed&limit=1");

        var failure = failures.GetProperty("items")[0];

        var replay = await Call("POST", Sendmock + "/webhooks/deliveries/" + failure.GetProperty("id").GetString() + "/replay", new { rerender = false });

        Assert.Equal("replay", replay.GetProperty("trigger").GetString());
    }
}
```

## What you should see

The new delivery with trigger "replay" and, after your fix, a 2xx.

## Try it in the demo

1. Open [Webhooks > Deliveries](/demo/webhooks/deliveries) and press **Failed**.
2. Open the first delivery.
3. Press **Replay** > **Replay as-is**. The drawer now shows the new delivery, with trigger "replay".

## Next

- [Deliveries](../webhooks/deliveries.md)
- [Composer and Saved](../webhooks/composer-and-saved.md)
