---
title: Reply by email
description: Answer a notification email as its recipient and have the reply posted to your app, as Mailgun Routes would.
---

> Works in your install from Phase 4. Try it in the [demo](/demo/mail) today.

**The situation:** your app emails ticket updates from `reply+<ticket>@reply.app.test`, and people answer by email. In production, Mailgun receives the reply and posts it to your app. You want to test that handler locally.

**You need:** your app's inbound mail handler URL.

## Steps

1. In **Settings > Email**, add `reply.app.test` to **Inbound domains** and save.
2. In **Webhooks > Inbound routes**, press **Add route**. Description "Ticket replies"; **Match recipient** with the pattern `reply\+(?P<ticket>.+)@reply.app.test`.
3. The route starts with a **Forward to URL** action: set its target to your handler's URL. Then **Add action** > **Stop**, and press **Add route**.
4. In your app, trigger a ticket notification. Open it in **Mail**, press **Reply** (`R`), write "Thanks, that fixed it." above the quoted text, and press **Send reply**.
5. Your handler gets Mailgun's form post. `stripped-text` holds only "Thanks, that fixed it.", and the ticket id is in the recipient.

## In your code

A test that answers a ticket notification as its recipient; the inbound route posts the reply to your handler.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
# In your app: email the ticket update to rahim@example.test

email=$(sendmock email wait --to rahim@example.test --timeout 10s --json)

reply=$(sendmock email reply "$(jq -r '.id' <<<"$email")" --body 'Thanks, that fixed it.' --json)

jq -e '.direction == "inbound"' <<<"$reply" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('posts a ticket reply to the handler', function () {
    $this->post('/tickets/318/notify');

    $email = Http::get(SENDMOCK.'/wait/email', [
        'to' => 'rahim@example.test',
        'timeout' => '10s',
    ])->throw()->json();

    $reply = Http::post(SENDMOCK."/emails/{$email['id']}/reply", ['body' => 'Thanks, that fixed it.'])->throw()->json();

    expect($reply['direction'])->toBe('inbound');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { APP, call, SENDMOCK } from "./sendmock.js";

test("posts a ticket reply to the handler", async () => {
  await call("POST", `${APP}/tickets/318/notify`);

  const email = await call("GET", `${SENDMOCK}/wait/email?to=rahim%40example.test&timeout=10s`);

  const reply = await call("POST", `${SENDMOCK}/emails/${email.id}/reply`, { body: "Thanks, that fixed it." });

  expect(reply.direction).toBe("inbound");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_posts_a_ticket_reply_to_the_handler():
    requests.post(f"{APP}/tickets/318/notify")

    email = requests.get(
        f"{SENDMOCK}/wait/email",
        params={"to": "rahim@example.test", "timeout": "10s"},
    ).json()

    reply = requests.post(
        f"{SENDMOCK}/emails/{email['id']}/reply",
        json={"body": "Thanks, that fixed it."},
    ).json()

    assert reply["direction"] == "inbound"
```

```go tab="Go"
package app_test

import "testing"

func TestPostsATicketReplyToTheHandler(t *testing.T) {
	call(t, "POST", app+"/tickets/318/notify", nil)

	email := call(t, "GET", sendmock+"/wait/email?to=rahim%40example.test&timeout=10s", nil).(map[string]any)

	reply := call(t, "POST", sendmock+"/emails/"+email["id"].(string)+"/reply", map[string]any{"body": "Thanks, that fixed it."}).(map[string]any)

	if got := reply["direction"]; got != "inbound" {
		t.Errorf("direction is %v, want %v", got, "inbound")
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

class ReplyByEmailTest {
    @Test
    void postsATicketReplyToTheHandler() throws Exception {
        call("POST", APP + "/tickets/318/notify", null);

        var email = call("GET", SENDMOCK + "/wait/email?to=rahim%40example.test&timeout=10s", null);

        var reply = call("POST", SENDMOCK + "/emails/" + email.get("id").asText() + "/reply", Map.of("body", "Thanks, that fixed it."));

        assertEquals("inbound", reply.get("direction").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, APP, SENDMOCK};

#[tokio::test]
async fn posts_a_ticket_reply_to_the_handler() {
    call("POST", &format!("{APP}/tickets/318/notify"), None).await;

    let email = call("GET", &format!("{SENDMOCK}/wait/email?to=rahim%40example.test&timeout=10s"), None).await;

    let reply = call("POST", &format!("{SENDMOCK}/emails/{}/reply", email["id"].as_str().unwrap()), Some(json!({"body": "Thanks, that fixed it."}))).await;

    assert_eq!(reply["direction"], "inbound");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Reply by email" do
  it "posts a ticket reply to the handler" do
    call("POST", "#{APP}/tickets/318/notify")

    email = call("GET", "#{SENDMOCK}/wait/email?to=rahim%40example.test&timeout=10s")

    reply = call("POST", "#{SENDMOCK}/emails/#{email["id"]}/reply", { "body" => "Thanks, that fixed it." })

    expect(reply["direction"]).to eq("inbound")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class ReplyByEmailTests
{
    [Fact]
    public async Task PostsATicketReplyToTheHandler()
    {
        await Call("POST", App + "/tickets/318/notify");

        var email = await Call("GET", Sendmock + "/wait/email?to=rahim%40example.test&timeout=10s");

        var reply = await Call("POST", Sendmock + "/emails/" + email.GetProperty("id").GetString() + "/reply", new { body = "Thanks, that fixed it." });

        Assert.Equal("inbound", reply.GetProperty("direction").GetString());
    }
}
```

## What you should see

The reply in Mail with an Inbound badge, its **Timeline** saying "Forwarded by route Ticket replies to ...", and the request in **Webhooks > Deliveries**.

## Try it in the demo

1. Open [Mail](/demo/mail) and click **Your verification code**.
2. Press **Reply**, type `Got it, thanks.` and press **Send reply**.
3. Press **Open** on the toast, then the **Timeline** tab: it shows "Forwarded by route Replies to no-reply to http://localhost:8000/webhooks/mail/inbound (200)".

## Next

- [Replies and forwards](../mail/replies-and-forwards.md)
- [Advanced: inbound routes](../advanced/inbound-routes.md)
