---
title: Logs
description: The raw SMTP sessions and API requests behind every message, including the ones SendMock rejected.
---

> Try it in the [demo](/demo/logs). Works in your install from Phase 1 (SMTP) and Phase 2 (API requests).

Mail, SMS and Payments show what arrived. Logs show **how** it arrived, and what did not: every SMTP conversation and every API call, including failed and rejected ones.

![The Logs screen with an SMTP transcript open](./images/logs.jpg)

## What it solves

- "My app says it sent the email, but nothing shows in Mail." The SMTP session shows the TLS or AUTH problem, or the command that failed.
- "My SMS call returns 400." The API request shows the body your app sent and SendMock's error, for example a Twilio test number's 21211.
- Checking what credentials, TLS version and EHLO name your mailer uses.

## How it connects

| Gets from | Sends to |
| --- | --- |
| every SMTP session behind [Mail](./mail/index.md) | **Open email**: the email a session stored |
| every API request behind [SMS](./sms/index.md), [Verify](./sms/verify.md), [Payments](./payments/index.md) and the email APIs | **Open message**: the SMS or email a request created |
| the SMS drawer's "Open in request log" and the email's source badge link here | |

## Use it

1. Press `G L`.
2. On **SMTP sessions**, press the **Failed** chip.
3. Open a session and read the transcript: client commands and server replies, colour-coded, with the failure reason on top.

## Everything on this screen

Two tabs, kept in the URL. Both load 50 rows at a time, the next page as you scroll ("Showing 50 of 5,021"), and their filters and search run over every row.

### SMTP sessions

A table: time, client address, EHLO name, TLS (version or Plain), AUTH (user and mechanism), result (Delivered, Rejected, Aborted), emails stored and duration. Failed sessions are highlighted with their reason. Chips (All, Delivered, Failed) and a search on client, EHLO name and user.

The drawer: the session facts, the failure reason, and the **transcript**, one line per command or reply, client and server told apart by colour and a C or S marker, reply codes coloured by class (2xx, 3xx, 4xx, 5xx), AUTH secrets masked, and the DATA line linking to the stored email. **Copy transcript** and **Open email**.

### API requests

A table: time, API (Native, Twilio, Vonage, SendGrid, ...), method, path, status and duration. Rejected requests (4xx and 5xx) are highlighted. Chips by status class (All, 2xx, 4xx, 5xx), an API picker and a path search.

The drawer: method, full path, status, duration and time; request headers (credentials masked); the request body (JSON formatted, forms as a field table) and the response body; **Open message** for what the request created.

## Customize

How long logs are kept follows retention in [Settings > General](./settings.md#general). To make SMTP fail on purpose, see [Advanced: chaos](./advanced/chaos.md).

## From your code

List the SMTP sessions that failed, for example after a test that expects your app to retry.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](./connect/index.md).

```bash tab="CLI" tab-group="language"
sessions=$(sendmock logs smtp --result failed --json)

session=$(jq '.items[0]' <<<"$sessions")

jq -e '.result == "failed"' <<<"$session" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('lists failed SMTP sessions', function () {
    $sessions = Http::get(SENDMOCK.'/logs/smtp', ['result' => 'failed'])->throw()->json();

    $session = $sessions['items'][0];

    expect($session['result'])->toBe('failed');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { call, SENDMOCK } from "./sendmock.js";

test("lists failed SMTP sessions", async () => {
  const sessions = await call("GET", `${SENDMOCK}/logs/smtp?result=failed`);

  const session = sessions.items[0];

  expect(session.result).toBe("failed");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_lists_failed_smtp_sessions():
    sessions = requests.get(f"{SENDMOCK}/logs/smtp", params={"result": "failed"}).json()

    session = sessions["items"][0]

    assert session["result"] == "failed"
```

```go tab="Go"
package app_test

import "testing"

func TestListsFailedSmtpSessions(t *testing.T) {
	sessions := call(t, "GET", sendmock+"/logs/smtp?result=failed", nil).(map[string]any)

	session := sessions["items"].([]any)[0].(map[string]any)

	if got := session["result"]; got != "failed" {
		t.Errorf("result is %v, want %v", got, "failed")
	}
}
```

```java tab="Java"
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class LogsTest {
    @Test
    void listsFailedSmtpSessions() throws Exception {
        var sessions = call("GET", SENDMOCK + "/logs/smtp?result=failed", null);

        var session = sessions.get("items").get(0);

        assertEquals("failed", session.get("result").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use sendmock::{call, SENDMOCK};

#[tokio::test]
async fn lists_failed_smtp_sessions() {
    let sessions = call("GET", &format!("{SENDMOCK}/logs/smtp?result=failed"), None).await;

    let session = &sessions["items"][0];

    assert_eq!(session["result"], "failed");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Logs" do
  it "lists failed SMTP sessions" do
    sessions = call("GET", "#{SENDMOCK}/logs/smtp?result=failed")

    session = sessions["items"][0]

    expect(session["result"]).to eq("failed")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class LogsTests
{
    [Fact]
    public async Task ListsFailedSmtpSessions()
    {
        var sessions = await Call("GET", Sendmock + "/logs/smtp?result=failed");

        var session = sessions.GetProperty("items")[0];

        Assert.Equal("failed", session.GetProperty("result").GetString());
    }
}
```

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| SMTP sessions | [`sendmock logs smtp`](/cli/logs/#logs-smtp) | [`GET /api/v1/logs/smtp`](/api/logs/#getLogsSmtp) | [`sendmock_logs_smtp`](/mcp/logs/#sendmock_logs_smtp) |
| one session | [`sendmock logs smtp show <sessionId>`](/cli/logs/#logs-smtp-show) | [`GET /api/v1/logs/smtp/{sessionId}`](/api/logs/#getLogsSmtpBySessionId) | [`sendmock_logs_smtp_get`](/mcp/logs/#sendmock_logs_smtp_get) |
| API requests | [`sendmock logs http`](/cli/logs/#logs-http) | [`GET /api/v1/logs/http`](/api/logs/#getLogsHttp) | [`sendmock_logs_http`](/mcp/logs/#sendmock_logs_http) |
| one request | [`sendmock logs http show <requestId>`](/cli/logs/#logs-http-show) | [`GET /api/v1/logs/http/{requestId}`](/api/logs/#getLogsHttpByRequestId) | [`sendmock_logs_http_get`](/mcp/logs/#sendmock_logs_http_get) |

## Related

- [Troubleshooting](./troubleshooting.md)
- [Mail](./mail/index.md)
