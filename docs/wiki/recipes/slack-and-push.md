---
title: Slack and push
description: Point your app's Slack webhook and push notification calls at the HTTP Catcher, so nothing reaches real people, and see each one previewed.
---

> Works in your install from Phase 4 (Slack, Discord, Telegram, FCM) and Phase 5 (Teams, Google Chat, Expo, OneSignal). Try it in the [demo](/demo/http) today.

**The situation:** your app posts to Slack when an order fails and sends push notifications when it ships. During development these reach the real team channel and real phones.

**You need:** the settings where your app keeps its Slack webhook URL and push API base URL.

## Steps

1. In **HTTP Catcher**, press **New bin**. Name `slack`, preset **Slack incoming webhook**, **Add bin**.
2. Copy the catch URL, `http://127.0.0.1:8025/catch/slack`, into your app's Slack webhook setting.
3. Press **New bin** again: name `push`, preset **Firebase Cloud Messaging v1** (or Expo push, OneSignal). Set your app's FCM base URL to `http://127.0.0.1:8025/catch/push`.
4. Trigger an alert and a push in your app.

## In your code

A test that fails an order and checks your app's Slack alert reached the `slack` bin, not the team.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
# In your app: fail order 42; your app posts to http://127.0.0.1:8025/catch/slack

alert=$(sendmock http wait --bin slack --method POST --timeout 10s --json)

jq -e '.bin_name == "slack"' <<<"$alert" >/dev/null
jq -e '.response_status == 200' <<<"$alert" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('posts the failed order to Slack', function () {
    $this->post('/orders/42/fail');

    $alert = Http::get(SENDMOCK.'/wait/http', [
        'bin' => 'slack',
        'method' => 'POST',
        'timeout' => '10s',
    ])->throw()->json();

    expect($alert['bin_name'])->toBe('slack');
    expect($alert['response_status'])->toBe(200);
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { APP, call, SENDMOCK } from "./sendmock.js";

test("posts the failed order to Slack", async () => {
  await call("POST", `${APP}/orders/42/fail`);

  const alert = await call("GET", `${SENDMOCK}/wait/http?bin=slack&method=POST&timeout=10s`);

  expect(alert.bin_name).toBe("slack");
  expect(alert.response_status).toBe(200);
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_posts_the_failed_order_to_slack():
    requests.post(f"{APP}/orders/42/fail")

    alert = requests.get(
        f"{SENDMOCK}/wait/http",
        params={"bin": "slack", "method": "POST", "timeout": "10s"},
    ).json()

    assert alert["bin_name"] == "slack"
    assert alert["response_status"] == 200
```

```go tab="Go"
package app_test

import "testing"

func TestPostsTheFailedOrderToSlack(t *testing.T) {
	call(t, "POST", app+"/orders/42/fail", nil)

	alert := call(t, "GET", sendmock+"/wait/http?bin=slack&method=POST&timeout=10s", nil).(map[string]any)

	if got := alert["bin_name"]; got != "slack" {
		t.Errorf("bin_name is %v, want %v", got, "slack")
	}
	if got := alert["response_status"]; got != float64(200) {
		t.Errorf("response_status is %v, want %v", got, float64(200))
	}
}
```

```java tab="Java"
import static app.SendMock.APP;
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class SlackAndPushTest {
    @Test
    void postsTheFailedOrderToSlack() throws Exception {
        call("POST", APP + "/orders/42/fail", null);

        var alert = call("GET", SENDMOCK + "/wait/http?bin=slack&method=POST&timeout=10s", null);

        assertEquals("slack", alert.get("bin_name").asText());
        assertEquals(200, alert.get("response_status").asInt());
    }
}
```

```rust tab="Rust"
mod sendmock;

use sendmock::{call, APP, SENDMOCK};

#[tokio::test]
async fn posts_the_failed_order_to_slack() {
    call("POST", &format!("{APP}/orders/42/fail"), None).await;

    let alert = call("GET", &format!("{SENDMOCK}/wait/http?bin=slack&method=POST&timeout=10s"), None).await;

    assert_eq!(alert["bin_name"], "slack");
    assert_eq!(alert["response_status"], 200);
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Slack and push" do
  it "posts the failed order to Slack" do
    call("POST", "#{APP}/orders/42/fail")

    alert = call("GET", "#{SENDMOCK}/wait/http?bin=slack&method=POST&timeout=10s")

    expect(alert["bin_name"]).to eq("slack")
    expect(alert["response_status"]).to eq(200)
  end
end
```

```csharp tab="C#"
using static SendMock;

public class SlackAndPushTests
{
    [Fact]
    public async Task PostsTheFailedOrderToSlack()
    {
        await Call("POST", App + "/orders/42/fail");

        var alert = await Call("GET", Sendmock + "/wait/http?bin=slack&method=POST&timeout=10s");

        Assert.Equal("slack", alert.GetProperty("bin_name").GetString());
        Assert.Equal(200, alert.GetProperty("response_status").GetInt32());
    }
}
```

## What you should see

Each request under its bin. **Preview** shows the Slack message as Slack draws it and the push as a phone notification card; **Response** shows SendMock answered as Slack and FCM do (`200 ok`, a message name), so your app carried on.

## Try it in the demo

1. Open [HTTP Catcher](/demo/http) and press **New bin**. Name it `alerts`, pick **Slack incoming webhook**, press **Add bin**. The catch URL shows `http://127.0.0.1:8025/catch/alerts`.
2. Click the `slack` bin and its first request: **Preview** shows a Slack message.

## Next

- [HTTP Catcher](../http/index.md)
- [Advanced: catcher responses](../advanced/catcher-responses.md): make the bin fail or slow down.
