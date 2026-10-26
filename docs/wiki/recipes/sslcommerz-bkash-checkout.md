---
title: SSLCommerz and bKash
description: Pay through SSLCommerz with a test bKash wallet, get the POST redirect and the signed IPN, and validate the payment.
---

> Works in your install from Phase 3P (SSLCommerz) and Phase 4 (bKash's own API). Try it in the [demo](/demo/payments/gateways) today.

**The situation:** your app sells in Bangladesh through SSLCommerz. Customers pay with cards, mobile wallets (bKash, Nagad, Rocket) or internet banking. You need to test the success, fail and cancel redirects, the IPN with its `verify_sign`, and the order validation call.

**You need:** your app's SSLCommerz client pointing at `http://127.0.0.1:8026`, and its IPN handler URL.

## Steps

1. In **Payments > Gateways**, edit **SSLCommerz**. On **Merchant**, set `store_id` and `store_passwd` to what your app sends, and the **Notification endpoint** to an endpoint for your IPN URL.
2. In your app, start a payment. The session answer sends the browser to SendMock's checkout page, with tabs: Cards, Mobile banking, Net banking.
3. Open **Mobile banking** and pick **bKash**. Enter `01770000001` and press **Confirm**, the code `123456` and **Confirm**, the PIN `12121` and **Confirm and pay**.
4. SendMock sends the browser back to your `success_url` **by POST** with SSLCommerz's fields (`status=VALID`, `tran_id`, `val_id`, ...), and posts the IPN.
5. Your app calls the order validation API with `val_id`; SendMock answers from the payment.

Try `01770000002` (insufficient balance) for the fail path, and **Cancel payment** in the test controls for the cancel path.

## In your code

A test that starts an SSLCommerz checkout and pays it with the test bKash wallet, as a customer would on the checkout page.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
payment=$(sendmock payments checkout create --provider sslcommerz --amount-minor 150000 --currency BDT --json)

checkout=$(sendmock payments checkout complete "$(jq -r '.id' <<<"$payment")" pay --method-key bkash --entries '{"number":"01770000001","otp":"123456","pin":"12121"}' --json)

jq -e '.state == "completed"' <<<"$checkout" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('pays with a test bKash wallet', function () {
    $payment = Http::post(SENDMOCK.'/payments/checkout', [
        'provider' => 'sslcommerz',
        'amount_minor' => 150000,
        'currency' => 'BDT',
    ])->throw()->json();

    $checkout = Http::post(SENDMOCK."/checkout-sessions/{$payment['id']}/complete", [
        'action' => 'pay',
        'method_key' => 'bkash',
        'entries' => [
            'number' => '01770000001',
            'otp' => '123456',
            'pin' => '12121',
        ],
    ])->throw()->json();

    expect($checkout['state'])->toBe('completed');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { call, SENDMOCK } from "./sendmock.js";

test("pays with a test bKash wallet", async () => {
  const payment = await call("POST", `${SENDMOCK}/payments/checkout`, {
    provider: "sslcommerz",
    amount_minor: 150000,
    currency: "BDT",
  });

  const checkout = await call("POST", `${SENDMOCK}/checkout-sessions/${payment.id}/complete`, {
    action: "pay",
    method_key: "bkash",
    entries: { number: "01770000001", otp: "123456", pin: "12121" },
  });

  expect(checkout.state).toBe("completed");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_pays_with_a_test_bkash_wallet():
    payment = requests.post(
        f"{SENDMOCK}/payments/checkout",
        json={
            "provider": "sslcommerz",
            "amount_minor": 150000,
            "currency": "BDT",
        },
    ).json()

    checkout = requests.post(
        f"{SENDMOCK}/checkout-sessions/{payment['id']}/complete",
        json={
            "action": "pay",
            "method_key": "bkash",
            "entries": {"number": "01770000001", "otp": "123456", "pin": "12121"},
        },
    ).json()

    assert checkout["state"] == "completed"
```

```go tab="Go"
package app_test

import "testing"

func TestPaysWithATestBkashWallet(t *testing.T) {
	payment := call(t, "POST", sendmock+"/payments/checkout", map[string]any{
		"provider":     "sslcommerz",
		"amount_minor": 150000,
		"currency":     "BDT",
	}).(map[string]any)

	checkout := call(t, "POST", sendmock+"/checkout-sessions/"+payment["id"].(string)+"/complete", map[string]any{
		"action":     "pay",
		"method_key": "bkash",
		"entries":    map[string]any{
			"number": "01770000001",
			"otp":    "123456",
			"pin":    "12121",
		},
	}).(map[string]any)

	if got := checkout["state"]; got != "completed" {
		t.Errorf("state is %v, want %v", got, "completed")
	}
}
```

```java tab="Java"
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class SslcommerzBkashCheckoutTest {
    @Test
    void paysWithATestBkashWallet() throws Exception {
        var payment = call("POST", SENDMOCK + "/payments/checkout", Map.of(
            "provider", "sslcommerz",
            "amount_minor", 150000,
            "currency", "BDT"
        ));

        var checkout = call("POST", SENDMOCK + "/checkout-sessions/" + payment.get("id").asText() + "/complete", Map.of(
            "action", "pay",
            "method_key", "bkash",
            "entries", Map.of(
                "number", "01770000001",
                "otp", "123456",
                "pin", "12121"
            )
        ));

        assertEquals("completed", checkout.get("state").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, SENDMOCK};

#[tokio::test]
async fn pays_with_a_test_bkash_wallet() {
    let payment = call("POST", &format!("{SENDMOCK}/payments/checkout"), Some(json!({
        "provider": "sslcommerz",
        "amount_minor": 150000,
        "currency": "BDT"
    }))).await;

    let checkout = call("POST", &format!("{SENDMOCK}/checkout-sessions/{}/complete", payment["id"].as_str().unwrap()), Some(json!({
        "action": "pay",
        "method_key": "bkash",
        "entries": {"number": "01770000001", "otp": "123456", "pin": "12121"}
    }))).await;

    assert_eq!(checkout["state"], "completed");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Sslcommerz bkash checkout" do
  it "pays with a test bKash wallet" do
    payment = call("POST", "#{SENDMOCK}/payments/checkout", {
      "provider" => "sslcommerz",
      "amount_minor" => 150000,
      "currency" => "BDT",
    })

    checkout = call("POST", "#{SENDMOCK}/checkout-sessions/#{payment["id"]}/complete", {
      "action" => "pay",
      "method_key" => "bkash",
      "entries" => {
        "number" => "01770000001",
        "otp" => "123456",
        "pin" => "12121",
      },
    })

    expect(checkout["state"]).to eq("completed")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class SslcommerzBkashCheckoutTests
{
    [Fact]
    public async Task PaysWithATestBkashWallet()
    {
        var payment = await Call("POST", Sendmock + "/payments/checkout", new
        {
            provider = "sslcommerz",
            amount_minor = 150000,
            currency = "BDT",
        });

        var checkout = await Call("POST", Sendmock + "/checkout-sessions/" + payment.GetProperty("id").GetString() + "/complete", new
        {
            action = "pay",
            method_key = "bkash",
            entries = new
            {
                number = "01770000001",
                otp = "123456",
                pin = "12121",
            },
        });

        Assert.Equal("completed", checkout.GetProperty("state").GetString());
    }
}
```

## What you should see

The payment in **Payments** with its redirect (POST, with the fields) and IPN in the timeline, and the IPN in **Webhooks > Deliveries**.

## Try it in the demo

1. Open [Payments > Gateways](/demo/payments/gateways), press **Edit SSLCommerz**, and on **Checkout** press **Open a test checkout**.
2. Open the **Mobile banking** tab and pick **bKash**.
3. Enter `01770000001`, **Confirm**; `123456`, **Confirm**; `12121`, **Confirm and pay**.
4. The result says the browser returns by POST, with `VALID` among the fields.

## Next

- [Checkout page](../payments/checkout-page.md)
- [Methods](../payments/methods.md)
