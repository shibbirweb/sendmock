---
title: Read a one-time code
description: Read a sign-up or login code from an email, an SMS or Twilio Verify, by hand or from a test.
---

> Works in your install from Phase 1 (email) and Phase 2 (SMS and Verify). Try it in the [demo](/demo/mail) today.

**The situation:** your app sends a one-time code by email or SMS. You need the code to finish the flow, by hand while developing and from your end-to-end tests.

**You need:** your app's mail or SMS settings pointing at SendMock. See [Connect your app](../connect/index.md).

## Steps

1. Trigger the code in your app (sign up, log in, confirm a phone number).
2. In SendMock, open the email in **Mail**, the conversation in **SMS**, or the verification in **SMS > Verify**.
3. The code is shown on its own with a copy button (**Copy code 482913**). Paste it into your app.

## In a test

```bash
# waits until a code arrives, then prints it
sendmock otp --to user@example.test --wait 10s
sendmock otp --to +8801700000000 --channel sms --wait 10s
```

Agents use the `sendmock_otp_get` MCP tool the same way.

## When no code is found

SendMock finds codes with the patterns in **Settings > OTP patterns**. If your app writes codes differently (for example `ABC-123`), add a pattern: [Advanced: OTP patterns](../advanced/otp-patterns.md).

## In your code

A test that signs up, waits for the emailed code and finishes the sign-up with it. For an SMS code, pass the phone number as `to` and `sms` as `channel`.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
# In your app: sign up as user@example.test

otp=$(sendmock otp --to user@example.test --wait 10s --json)

# In your app: enter the code

jq -e '.channel == "email"' <<<"$otp" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('signs up with the emailed code', function () {
    $this->post('/register', ['email' => 'user@example.test']);

    $otp = Http::get(SENDMOCK.'/otp', [
        'to' => 'user@example.test',
        'timeout' => '10s',
    ])->throw()->json();

    $this->post('/verify', ['code' => $otp['code']]);

    expect($otp['channel'])->toBe('email');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { APP, call, SENDMOCK } from "./sendmock.js";

test("signs up with the emailed code", async () => {
  await call("POST", `${APP}/register`, { email: "user@example.test" });

  const otp = await call("GET", `${SENDMOCK}/otp?to=user%40example.test&timeout=10s`);

  await call("POST", `${APP}/verify`, { code: otp.code });

  expect(otp.channel).toBe("email");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_signs_up_with_the_emailed_code():
    requests.post(f"{APP}/register", json={"email": "user@example.test"})

    otp = requests.get(
        f"{SENDMOCK}/otp",
        params={"to": "user@example.test", "timeout": "10s"},
    ).json()

    requests.post(f"{APP}/verify", json={"code": otp["code"]})

    assert otp["channel"] == "email"
```

```go tab="Go"
package app_test

import "testing"

func TestSignsUpWithTheEmailedCode(t *testing.T) {
	call(t, "POST", app+"/register", map[string]any{"email": "user@example.test"})

	otp := call(t, "GET", sendmock+"/otp?to=user%40example.test&timeout=10s", nil).(map[string]any)

	call(t, "POST", app+"/verify", map[string]any{"code": otp["code"]})

	if got := otp["channel"]; got != "email" {
		t.Errorf("channel is %v, want %v", got, "email")
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

class ReadACodeTest {
    @Test
    void signsUpWithTheEmailedCode() throws Exception {
        call("POST", APP + "/register", Map.of("email", "user@example.test"));

        var otp = call("GET", SENDMOCK + "/otp?to=user%40example.test&timeout=10s", null);

        call("POST", APP + "/verify", Map.of("code", otp.get("code")));

        assertEquals("email", otp.get("channel").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, APP, SENDMOCK};

#[tokio::test]
async fn signs_up_with_the_emailed_code() {
    call("POST", &format!("{APP}/register"), Some(json!({"email": "user@example.test"}))).await;

    let otp = call("GET", &format!("{SENDMOCK}/otp?to=user%40example.test&timeout=10s"), None).await;

    call("POST", &format!("{APP}/verify"), Some(json!({"code": otp["code"].clone()}))).await;

    assert_eq!(otp["channel"], "email");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Read a code" do
  it "signs up with the emailed code" do
    call("POST", "#{APP}/register", { "email" => "user@example.test" })

    otp = call("GET", "#{SENDMOCK}/otp?to=user%40example.test&timeout=10s")

    call("POST", "#{APP}/verify", { "code" => otp["code"] })

    expect(otp["channel"]).to eq("email")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class ReadACodeTests
{
    [Fact]
    public async Task SignsUpWithTheEmailedCode()
    {
        await Call("POST", App + "/register", new { email = "user@example.test" });

        var otp = await Call("GET", Sendmock + "/otp?to=user%40example.test&timeout=10s");

        await Call("POST", App + "/verify", new { code = otp.GetProperty("code") });

        Assert.Equal("email", otp.GetProperty("channel").GetString());
    }
}
```

## What you should see

The code beside the message, and the same code from `sendmock otp`.

## Try it in the demo

1. Open [Mail](/demo/mail) and click **Your verification code**.
2. The code `482913` shows under the header with **Copy code 482913**.

## Next

- [Twilio Verify login](./twilio-verify-login.md)
- [Advanced: OTP patterns](../advanced/otp-patterns.md)
