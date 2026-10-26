---
title: Overview
description: The home dashboard. Counts, activity, webhook health, recent failures and how to connect, live.
---

> Try it in the [demo](/demo/). Works in your install from Phase 1 (message counts) and Phase 3 (webhook health).

The first screen you see: what SendMock has caught, how your webhooks are doing, and the addresses your app needs.

![The Overview dashboard](./images/overview.jpg)

## What it solves

- "Did my last test send anything at all?" The counts and latest messages answer it at a glance.
- "Which webhook is failing, and why?" Webhooks by endpoint and Recent failures point at it.
- "Where do I point my app again?" The connect card has the SMTP address and API URL to copy.

## How it connects

| Gets from | Sends to |
| --- | --- |
| counts from [Mail](./mail/index.md), [SMS](./sms/index.md), [Verify](./sms/verify.md), [HTTP](./http/index.md) and [Payments](./payments/index.md) | each tile links to its screen |
| delivery health from [Webhooks](./webhooks/index.md) | each failure links to its delivery in [Deliveries](./webhooks/deliveries.md) |
| the listeners from [Settings > Connection](./settings.md#connection) | copy buttons for your app's settings |

Everything updates live as events arrive; there is nothing to refresh.

## Use it

1. Open SendMock (or press `G O`).
2. Read the KPI row: emails, SMS, verifications (pending ones called out), HTTP requests, webhook success rate and payments, each with today's count.
3. If a webhook failed, click it under **Recent failures** to open the delivery and see your app's answer.
4. Copy the SMTP address or API base URL from **Connect your app** into your app's settings.

## Everything on this screen

### KPI row

One tile per area with its total and today's count, linking to its screen. Verify calls out pending verifications. Payments shows the payment count, success rate (succeeded among finished payments) and test revenue per currency (captured minus refunded).

### Activity, last 24 hours

Stacked columns per hour for emails, SMS and HTTP requests. Hover a column, or focus the chart and use the arrow keys, to see every series for that hour. **Show as table** shows the same numbers as a table.

### Webhooks by endpoint

For each endpoint: deliveries in the last 24 hours, a success-rate meter, p50 and p95 latency, retries and the most common failure codes. The full version, with ranges and filters, is [Webhooks > Overview](./webhooks/index.md#the-webhooks-overview-screen).

### Recent failures

The last failed or exhausted deliveries: time, endpoint, event, and the status code or error. Each opens the delivery.

### Latest messages

The newest emails and SMS, each linking to it. With nothing yet, it offers **Send a sample email** and **Send a sample SMS**.

### Connect your app

The SMTP address and API base URL with copy buttons, and a link to [Settings > Connection](./settings.md#connection) for full snippets per language.

## Customize

Nothing to configure here. What the tiles count follows your retention in [Settings > General](./settings.md#general).

## From your code

Start a test from a clean slate and read the numbers the Overview shows.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](./connect/index.md).

```bash tab="CLI" tab-group="language"
sendmock reset --yes

stats=$(sendmock stats --json)

jq -e '.email_count == 0' <<<"$stats" >/dev/null
jq -e '.sms_count == 0' <<<"$stats" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('starts with empty counts', function () {
    Http::post(SENDMOCK.'/reset')->throw();

    $stats = Http::get(SENDMOCK.'/stats')->throw()->json();

    expect($stats['email_count'])->toBe(0);
    expect($stats['sms_count'])->toBe(0);
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { call, SENDMOCK } from "./sendmock.js";

test("starts with empty counts", async () => {
  await call("POST", `${SENDMOCK}/reset`);

  const stats = await call("GET", `${SENDMOCK}/stats`);

  expect(stats.email_count).toBe(0);
  expect(stats.sms_count).toBe(0);
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_starts_with_empty_counts():
    requests.post(f"{SENDMOCK}/reset").raise_for_status()

    stats = requests.get(f"{SENDMOCK}/stats").json()

    assert stats["email_count"] == 0
    assert stats["sms_count"] == 0
```

```go tab="Go"
package app_test

import "testing"

func TestStartsWithEmptyCounts(t *testing.T) {
	call(t, "POST", sendmock+"/reset", nil)

	stats := call(t, "GET", sendmock+"/stats", nil).(map[string]any)

	if got := stats["email_count"]; got != float64(0) {
		t.Errorf("email_count is %v, want %v", got, float64(0))
	}
	if got := stats["sms_count"]; got != float64(0) {
		t.Errorf("sms_count is %v, want %v", got, float64(0))
	}
}
```

```java tab="Java"
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class OverviewTest {
    @Test
    void startsWithEmptyCounts() throws Exception {
        call("POST", SENDMOCK + "/reset", null);

        var stats = call("GET", SENDMOCK + "/stats", null);

        assertEquals(0, stats.get("email_count").asInt());
        assertEquals(0, stats.get("sms_count").asInt());
    }
}
```

```rust tab="Rust"
mod sendmock;

use sendmock::{call, SENDMOCK};

#[tokio::test]
async fn starts_with_empty_counts() {
    call("POST", &format!("{SENDMOCK}/reset"), None).await;

    let stats = call("GET", &format!("{SENDMOCK}/stats"), None).await;

    assert_eq!(stats["email_count"], 0);
    assert_eq!(stats["sms_count"], 0);
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Overview" do
  it "starts with empty counts" do
    call("POST", "#{SENDMOCK}/reset")

    stats = call("GET", "#{SENDMOCK}/stats")

    expect(stats["email_count"]).to eq(0)
    expect(stats["sms_count"]).to eq(0)
  end
end
```

```csharp tab="C#"
using static SendMock;

public class OverviewTests
{
    [Fact]
    public async Task StartsWithEmptyCounts()
    {
        await Call("POST", Sendmock + "/reset");

        var stats = await Call("GET", Sendmock + "/stats");

        Assert.Equal(0, stats.GetProperty("email_count").GetInt32());
        Assert.Equal(0, stats.GetProperty("sms_count").GetInt32());
    }
}
```

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| the same counts | [`sendmock stats`](/cli/system/#stats) | [`GET /api/v1/stats`](/api/system/#getStats) | [`sendmock_stats`](/mcp/system/#sendmock_stats) |
| is it running, which ports | [`sendmock status`](/cli/system/#status) | [`GET /api/v1/info`](/api/system/#getInfo) | [`sendmock_status`](/mcp/system/#sendmock_status) |
| is it alive | [`sendmock health`](/cli/system/#health) | [`GET /api/v1/health`](/api/system/#getHealth) | [`sendmock_status`](/mcp/system/#sendmock_status) |

## Related

- [How it all connects](./how-it-connects.md)
- [Webhooks](./webhooks/index.md)
