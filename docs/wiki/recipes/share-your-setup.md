---
title: Share your setup
description: Export your endpoints, rules, templates, numbers and settings as a setup file, commit it or carry it to another machine, and give your team and CI the same SendMock.
---

> Try it in the [demo](/demo/settings?section=setup).

**The situation:** you set up endpoints, rules, numbers and a Verify service. A teammate, and your CI, should start with exactly the same, and every test run should start clean.

## Steps

1. In **Settings > Setup**, press **Export sendmock.seed.toml**. Or, under **Export a setup**, pick TOML, JSON or YAML and the sections, and press **Export**.
2. Put the file in your app's repository, next to your code, and commit it. Secrets are written as `${ENV_VAR}` references, never in plain text; set those variables on each machine.
3. Start SendMock with it: `sendmock --seed sendmock.seed.toml` (or mount it at `/config/sendmock.seed.toml` in Docker).
4. Before each test run, reset to it: **Settings > General > Reset to seed**, or `sendmock reset --yes`, or `POST /api/v1/reset`. Traffic is deleted and the configuration is the file's again.

The same export from the command line:

```bash
sendmock setup export --format yaml > sendmock.setup.yaml
```

Export only some sections with `--only` (a section such as `webhook.endpoints`, or a group such as `webhook`), or leave some out with `--except`:

```bash
sendmock setup export --only webhook --only numbers > webhooks.setup.toml
```

## Move to another machine

To carry your own setup to your other machine, secrets included:

1. Export with the secrets encrypted. Pick a passphrase of 8 characters or more; SendMock does not keep it.

   ```bash
   SENDMOCK_SETUP_PASSPHRASE='correct horse battery' sendmock setup export --include-secrets > sendmock.setup.toml
   ```

   In the app: **Settings > Setup > Export a setup**, choose **Encrypted with a passphrase**, type the passphrase and press **Export**.
2. Copy `sendmock.setup.toml` to the other machine.
3. Check what the import would change. Nothing is applied yet.

   ```bash
   SENDMOCK_SETUP_PASSPHRASE='correct horse battery' sendmock setup validate sendmock.setup.toml
   ```

4. Import it. **Merge** (the default) adds and updates what the file holds by name and keeps everything else, so it never asks to confirm; `--mode replace` also removes what the file does not hold, and when it would remove something it names each item and asks you to run it again with `--confirm-removed-count <count>`.

   ```bash
   SENDMOCK_SETUP_PASSPHRASE='correct horse battery' sendmock setup import sendmock.setup.toml
   ```

   In the app: **Settings > Setup > Import a setup**, upload the file, type the passphrase, press **Preview**, then **Import**.

Without the passphrase, or with a wrong one, the import is refused and nothing changes. A secret is never written in plain text.

## Import from a URL

A setup can come from an `https://` address, such as a raw file in a repository or a gist:

```bash
sendmock setup import --url https://example.com/sendmock.setup.toml
```

- Add `--sha256 <digest>` to refuse a file that changed since you checked it.
- Add `--header "Authorization: Bearer <token>"` for a private address. The header's value is never shown or logged.
- The download is at most 1 MB and 10 seconds, and follows at most 3 redirects, all to `https://`. Plain `http://` works only for this machine and private networks, such as a file served inside your CI.

In the app: **Settings > Setup > Import a setup > URL**.

## A file from another version

Every setup file starts with a `[sendmock]` header that names its format version. A file from an older SendMock is upgraded for the import, and your file stays as it is; keep the upgraded copy with:

```bash
sendmock setup migrate sendmock.setup.toml > sendmock.setup.upgraded.toml
```

A file from a newer SendMock is refused before anything changes, with the version to update to. The format versions are listed on [Docs versions](../versions.md#setup-file-format-versions).

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

1. Open [Settings > Setup](/demo/settings?section=setup).
2. Press **Export sendmock.seed.toml**. The file downloads.
3. Under **Import a setup**, paste a file, choose **Replace** and press **Preview** to see what it would add, change and remove.

## Next

- [Advanced: seed file](../advanced/seed-file.md)
- [Configuration and seed file](../configuration.md)
