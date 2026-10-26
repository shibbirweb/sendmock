---
title: Share your setup
description: Export your endpoints, rules, templates, numbers and settings as a seed file, commit it, and give your team and CI the same SendMock.
---

> Works in your install from Phase 3 (the full seed file). Try it in the [demo](/demo/settings?section=seed) today.

**The situation:** you set up endpoints, rules, numbers and a Verify service. A teammate, and your CI, should start with exactly the same, and every test run should start clean.

## Steps

1. In **Settings > Seed**, press **Export sendmock.seed.toml**.
2. Put the file in your app's repository, next to your code, and commit it. Secrets are written as `${ENV_VAR}` references, never in plain text; set those variables on each machine.
3. Start SendMock with it: `sendmock --seed sendmock.seed.toml` (or mount it at `/config/sendmock.seed.toml` in Docker).
4. Before each test run, reset to it: **Settings > General > Reset to seed**, or `sendmock reset --yes`, or `POST /api/v1/reset`. Traffic is deleted and the configuration is the file's again.

## In your code

Run this before each test: traffic is deleted and the configuration is the seed file's again.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
sendmock reset --yes

stats=$(sendmock stats --json)

jq -e '.email_count == 0' <<<"$stats" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('starts from the seed', function () {
    Http::post(SENDMOCK.'/reset')->throw();

    $stats = Http::get(SENDMOCK.'/stats')->throw()->json();

    expect($stats['email_count'])->toBe(0);
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { call, SENDMOCK } from "./sendmock.js";

test("starts from the seed", async () => {
  await call("POST", `${SENDMOCK}/reset`);

  const stats = await call("GET", `${SENDMOCK}/stats`);

  expect(stats.email_count).toBe(0);
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_starts_from_the_seed():
    requests.post(f"{SENDMOCK}/reset").raise_for_status()

    stats = requests.get(f"{SENDMOCK}/stats").json()

    assert stats["email_count"] == 0
```

```go tab="Go"
package app_test

import "testing"

func TestStartsFromTheSeed(t *testing.T) {
	call(t, "POST", sendmock+"/reset", nil)

	stats := call(t, "GET", sendmock+"/stats", nil).(map[string]any)

	if got := stats["email_count"]; got != float64(0) {
		t.Errorf("email_count is %v, want %v", got, float64(0))
	}
}
```

```java tab="Java"
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ShareYourSetupTest {
    @Test
    void startsFromTheSeed() throws Exception {
        call("POST", SENDMOCK + "/reset", null);

        var stats = call("GET", SENDMOCK + "/stats", null);

        assertEquals(0, stats.get("email_count").asInt());
    }
}
```

```rust tab="Rust"
mod sendmock;

use sendmock::{call, SENDMOCK};

#[tokio::test]
async fn starts_from_the_seed() {
    call("POST", &format!("{SENDMOCK}/reset"), None).await;

    let stats = call("GET", &format!("{SENDMOCK}/stats"), None).await;

    assert_eq!(stats["email_count"], 0);
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Share your setup" do
  it "starts from the seed" do
    call("POST", "#{SENDMOCK}/reset")

    stats = call("GET", "#{SENDMOCK}/stats")

    expect(stats["email_count"]).to eq(0)
  end
end
```

```csharp tab="C#"
using static SendMock;

public class ShareYourSetupTests
{
    [Fact]
    public async Task StartsFromTheSeed()
    {
        await Call("POST", Sendmock + "/reset");

        var stats = await Call("GET", Sendmock + "/stats");

        Assert.Equal(0, stats.GetProperty("email_count").GetInt32());
    }
}
```

## What you should see

On a teammate's machine, the same endpoints, rules, templates, variables (secrets from their environment), numbers, Messaging Services, Verify services, payment setup and settings.

## Try it in the demo

1. Open [Settings > Seed](/demo/settings?section=seed).
2. Press **Export sendmock.seed.toml**. The file downloads.

## Next

- [Advanced: seed file](../advanced/seed-file.md)
- [Configuration and seed file](../configuration.md)
