---
title: Password reset email
description: Catch your app's password reset email, check it, and follow its link to finish the reset.
---

> Works in your install from Phase 1. Try it in the [demo](/demo/mail) today.

**The situation:** you are building or changing password reset. You want to click the reset link without a real inbox, and check the email looks right.

**You need:** your app's mail settings pointing at SendMock (`127.0.0.1:1025`). See [Connect your app](../connect/index.md).

## Steps

1. In your app, request a password reset for any address, for example `rahim@example.test`.
2. In SendMock, open **Mail**. The reset email is at the top.
3. Open it. Under the header, the extracted panel lists the reset link with **Copy link**.
4. Click the link (it opens in a new tab) and finish the reset in your app.
5. Check the email: switch the **HTML** tab to **Mobile width**, and read the **Text** tab for people without HTML.

## In a test

```bash
sendmock email wait --to rahim@example.test --subject "Reset your password" --timeout 10s
sendmock links --to rahim@example.test
```

`sendmock links` prints the links of the latest email to that address, so a test can open the reset page.

## In your code

A test that asks your app for a password reset, waits for the email and reads its reset link.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
# In your app: request a password reset for rahim@example.test

email=$(sendmock email wait --to rahim@example.test --subject 'Reset your password' --timeout 10s --json)

links=$(sendmock links --to rahim@example.test --json)

# In your app: open the first link and choose a new password

jq -e '.subject == "Reset your password"' <<<"$email" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('sends a password reset link', function () {
    $this->post('/forgot-password', ['email' => 'rahim@example.test']);

    $email = Http::get(SENDMOCK.'/wait/email', [
        'to' => 'rahim@example.test',
        'subject' => 'Reset your password',
        'timeout' => '10s',
    ])->throw()->json();

    $links = Http::get(SENDMOCK.'/links', ['to' => 'rahim@example.test'])->throw()->json();

    $this->post('/reset-password', [
        'link' => $links['links'][0],
        'password' => 'a-new-password',
    ]);

    expect($email['subject'])->toBe('Reset your password');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { APP, call, SENDMOCK } from "./sendmock.js";

test("sends a password reset link", async () => {
  await call("POST", `${APP}/forgot-password`, { email: "rahim@example.test" });

  const email = await call("GET", `${SENDMOCK}/wait/email?to=rahim%40example.test&subject=Reset%20your%20password&timeout=10s`);

  const links = await call("GET", `${SENDMOCK}/links?to=rahim%40example.test`);

  await call("POST", `${APP}/reset-password`, { link: links.links[0], password: "a-new-password" });

  expect(email.subject).toBe("Reset your password");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_sends_a_password_reset_link():
    requests.post(f"{APP}/forgot-password", json={"email": "rahim@example.test"})

    email = requests.get(
        f"{SENDMOCK}/wait/email",
        params={
            "to": "rahim@example.test",
            "subject": "Reset your password",
            "timeout": "10s",
        },
    ).json()

    links = requests.get(
        f"{SENDMOCK}/links",
        params={"to": "rahim@example.test"},
    ).json()

    requests.post(
        f"{APP}/reset-password",
        json={"link": links["links"][0], "password": "a-new-password"},
    )

    assert email["subject"] == "Reset your password"
```

```go tab="Go"
package app_test

import "testing"

func TestSendsAPasswordResetLink(t *testing.T) {
	call(t, "POST", app+"/forgot-password", map[string]any{"email": "rahim@example.test"})

	email := call(t, "GET", sendmock+"/wait/email?to=rahim%40example.test&subject=Reset%20your%20password&timeout=10s", nil).(map[string]any)

	links := call(t, "GET", sendmock+"/links?to=rahim%40example.test", nil).(map[string]any)

	call(t, "POST", app+"/reset-password", map[string]any{
		"link":     links["links"].([]any)[0],
		"password": "a-new-password",
	})

	if got := email["subject"]; got != "Reset your password" {
		t.Errorf("subject is %v, want %v", got, "Reset your password")
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

class PasswordResetEmailTest {
    @Test
    void sendsAPasswordResetLink() throws Exception {
        call("POST", APP + "/forgot-password", Map.of("email", "rahim@example.test"));

        var email = call("GET", SENDMOCK + "/wait/email?to=rahim%40example.test&subject=Reset%20your%20password&timeout=10s", null);

        var links = call("GET", SENDMOCK + "/links?to=rahim%40example.test", null);

        call("POST", APP + "/reset-password", Map.of(
            "link", links.get("links").get(0),
            "password", "a-new-password"
        ));

        assertEquals("Reset your password", email.get("subject").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, APP, SENDMOCK};

#[tokio::test]
async fn sends_a_password_reset_link() {
    call("POST", &format!("{APP}/forgot-password"), Some(json!({"email": "rahim@example.test"}))).await;

    let email = call("GET", &format!("{SENDMOCK}/wait/email?to=rahim%40example.test&subject=Reset%20your%20password&timeout=10s"), None).await;

    let links = call("GET", &format!("{SENDMOCK}/links?to=rahim%40example.test"), None).await;

    call("POST", &format!("{APP}/reset-password"), Some(json!({
        "link": links["links"][0].clone(),
        "password": "a-new-password"
    }))).await;

    assert_eq!(email["subject"], "Reset your password");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Password reset email" do
  it "sends a password reset link" do
    call("POST", "#{APP}/forgot-password", { "email" => "rahim@example.test" })

    email = call("GET", "#{SENDMOCK}/wait/email?to=rahim%40example.test&subject=Reset%20your%20password&timeout=10s")

    links = call("GET", "#{SENDMOCK}/links?to=rahim%40example.test")

    call("POST", "#{APP}/reset-password", {
      "link" => links["links"][0],
      "password" => "a-new-password",
    })

    expect(email["subject"]).to eq("Reset your password")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class PasswordResetEmailTests
{
    [Fact]
    public async Task SendsAPasswordResetLink()
    {
        await Call("POST", App + "/forgot-password", new { email = "rahim@example.test" });

        var email = await Call("GET", Sendmock + "/wait/email?to=rahim%40example.test&subject=Reset%20your%20password&timeout=10s");

        var links = await Call("GET", Sendmock + "/links?to=rahim%40example.test");

        await Call("POST", App + "/reset-password", new
        {
            link = links.GetProperty("links")[0],
            password = "a-new-password",
        });

        Assert.Equal("Reset your password", email.GetProperty("subject").GetString());
    }
}
```

## What you should see

The email in Mail within a second, the link in the extracted panel, and your app's reset page when you open it.

## Try it in the demo

1. Open [Mail](/demo/mail) and click **Reset your password**.
2. The extracted panel shows `https://acme.test/reset?token=9f8e7d6c` with **Copy link**.
3. Press **Mobile width** to see the email at phone width.

## Next

- [Read a one-time code](./read-a-code.md)
- [Reading and checks](../mail/reading-and-checks.md)
