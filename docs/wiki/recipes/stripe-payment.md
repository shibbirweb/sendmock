---
title: Stripe payment
description: Create a Stripe Checkout Session, pay with a test card on the test checkout page, and handle Stripe's signed webhook.
---

> Works in your install from Phase 3P. Try it in the [demo](/demo/payments/gateways) today.

**The situation:** your app takes payments with Stripe Checkout. You want to run the whole flow (your page, Stripe's page, back to yours, the webhook) without a Stripe account, internet or a tunnel.

**You need:** your app's Stripe client pointing at `http://127.0.0.1:8026` (Stripe SDKs accept a base URL), and your webhook handler's URL.

## Steps

1. In **Payments > Gateways**, edit **Stripe**. On **Merchant**, set the **Notification endpoint** to an endpoint for your handler (create it in **Webhooks > Endpoints** first). Its `whsec_` secret is the one your app verifies `Stripe-Signature` with.
2. In your app, start a checkout. Stripe's answer sends the browser to SendMock's checkout page.
3. Pay with `4242 4242 4242 4242`, any future expiry and any CVC.
4. The page shows where it sends the browser (your `success_url` with `session_id`) and **Return to Acme Shop**. Follow it.
5. Your handler receives `checkout.session.completed`, signed with `Stripe-Signature`, so `stripe.webhooks.constructEvent` accepts it.

Now try the other paths: `4000 0000 0000 0002` (declined), `4000 0025 0000 3155` (3-D Secure), or **Simulate > Refund...** on the payment.

## In your code

A test that starts a Stripe checkout, pays with the `4242` test card and waits for the payment to succeed.

The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small `call` helper shown under **Test helper** on their page in [Connect your app](../connect/index.md).

```bash tab="CLI" tab-group="language"
payment=$(sendmock payments checkout create --provider stripe --amount-minor 1999 --currency USD --json)

sendmock payments checkout complete "$(jq -r '.id' <<<"$payment")" pay --method-key card --card '{"number":"4242424242424242","exp_month":12,"exp_year":2030,"cvc":"123","holder_name":"Sam Tester"}'

paid=$(sendmock payments wait --provider stripe --status succeeded --timeout 10s --json)

jq -e '.status == "succeeded"' <<<"$paid" >/dev/null
```

```php tab="PHP"
<?php

use Illuminate\Support\Facades\Http;

const SENDMOCK = 'http://127.0.0.1:8025/api/v1';

it('pays with a test card', function () {
    $payment = Http::post(SENDMOCK.'/payments/checkout', [
        'provider' => 'stripe',
        'amount_minor' => 1999,
        'currency' => 'USD',
    ])->throw()->json();

    Http::post(SENDMOCK."/checkout-sessions/{$payment['id']}/complete", [
        'action' => 'pay',
        'method_key' => 'card',
        'card' => [
            'number' => '4242424242424242',
            'exp_month' => 12,
            'exp_year' => 2030,
            'cvc' => '123',
            'holder_name' => 'Sam Tester',
        ],
    ])->throw();

    $paid = Http::get(SENDMOCK.'/wait/payment', [
        'provider' => 'stripe',
        'status' => 'succeeded',
        'timeout' => '10s',
    ])->throw()->json();

    expect($paid['status'])->toBe('succeeded');
});
```

```js tab="JavaScript"
import { expect, test } from "vitest";

import { call, SENDMOCK } from "./sendmock.js";

test("pays with a test card", async () => {
  const payment = await call("POST", `${SENDMOCK}/payments/checkout`, { provider: "stripe", amount_minor: 1999, currency: "USD" });

  await call("POST", `${SENDMOCK}/checkout-sessions/${payment.id}/complete`, {
    action: "pay",
    method_key: "card",
    card: {
      number: "4242424242424242",
      exp_month: 12,
      exp_year: 2030,
      cvc: "123",
      holder_name: "Sam Tester",
    },
  });

  const paid = await call("GET", `${SENDMOCK}/wait/payment?provider=stripe&status=succeeded&timeout=10s`);

  expect(paid.status).toBe("succeeded");
});
```

```python tab="Python"
import requests

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:8000"


def test_pays_with_a_test_card():
    payment = requests.post(
        f"{SENDMOCK}/payments/checkout",
        json={
            "provider": "stripe",
            "amount_minor": 1999,
            "currency": "USD",
        },
    ).json()

    requests.post(
        f"{SENDMOCK}/checkout-sessions/{payment['id']}/complete",
        json={
            "action": "pay",
            "method_key": "card",
            "card": {
                "number": "4242424242424242",
                "exp_month": 12,
                "exp_year": 2030,
                "cvc": "123",
                "holder_name": "Sam Tester",
            },
        },
    ).raise_for_status()

    paid = requests.get(
        f"{SENDMOCK}/wait/payment",
        params={
            "provider": "stripe",
            "status": "succeeded",
            "timeout": "10s",
        },
    ).json()

    assert paid["status"] == "succeeded"
```

```go tab="Go"
package app_test

import "testing"

func TestPaysWithATestCard(t *testing.T) {
	payment := call(t, "POST", sendmock+"/payments/checkout", map[string]any{
		"provider":     "stripe",
		"amount_minor": 1999,
		"currency":     "USD",
	}).(map[string]any)

	call(t, "POST", sendmock+"/checkout-sessions/"+payment["id"].(string)+"/complete", map[string]any{
		"action":     "pay",
		"method_key": "card",
		"card":       map[string]any{
			"number":      "4242424242424242",
			"exp_month":   12,
			"exp_year":    2030,
			"cvc":         "123",
			"holder_name": "Sam Tester",
		},
	})

	paid := call(t, "GET", sendmock+"/wait/payment?provider=stripe&status=succeeded&timeout=10s", nil).(map[string]any)

	if got := paid["status"]; got != "succeeded" {
		t.Errorf("status is %v, want %v", got, "succeeded")
	}
}
```

```java tab="Java"
import static app.SendMock.SENDMOCK;
import static app.SendMock.call;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class StripePaymentTest {
    @Test
    void paysWithATestCard() throws Exception {
        var payment = call("POST", SENDMOCK + "/payments/checkout", Map.of(
            "provider", "stripe",
            "amount_minor", 1999,
            "currency", "USD"
        ));

        call("POST", SENDMOCK + "/checkout-sessions/" + payment.get("id").asText() + "/complete", Map.of(
            "action", "pay",
            "method_key", "card",
            "card", Map.of(
                "number", "4242424242424242",
                "exp_month", 12,
                "exp_year", 2030,
                "cvc", "123",
                "holder_name", "Sam Tester"
            )
        ));

        var paid = call("GET", SENDMOCK + "/wait/payment?provider=stripe&status=succeeded&timeout=10s", null);

        assertEquals("succeeded", paid.get("status").asText());
    }
}
```

```rust tab="Rust"
mod sendmock;

use serde_json::json;
use sendmock::{call, SENDMOCK};

#[tokio::test]
async fn pays_with_a_test_card() {
    let payment = call("POST", &format!("{SENDMOCK}/payments/checkout"), Some(json!({
        "provider": "stripe",
        "amount_minor": 1999,
        "currency": "USD"
    }))).await;

    call("POST", &format!("{SENDMOCK}/checkout-sessions/{}/complete", payment["id"].as_str().unwrap()), Some(json!({
        "action": "pay",
        "method_key": "card",
        "card": {
            "number": "4242424242424242",
            "exp_month": 12,
            "exp_year": 2030,
            "cvc": "123",
            "holder_name": "Sam Tester"
        }
    }))).await;

    let paid = call("GET", &format!("{SENDMOCK}/wait/payment?provider=stripe&status=succeeded&timeout=10s"), None).await;

    assert_eq!(paid["status"], "succeeded");
}
```

```ruby tab="Ruby"
require_relative "sendmock_helper"

RSpec.describe "Stripe payment" do
  it "pays with a test card" do
    payment = call("POST", "#{SENDMOCK}/payments/checkout", {
      "provider" => "stripe",
      "amount_minor" => 1999,
      "currency" => "USD",
    })

    call("POST", "#{SENDMOCK}/checkout-sessions/#{payment["id"]}/complete", {
      "action" => "pay",
      "method_key" => "card",
      "card" => {
        "number" => "4242424242424242",
        "exp_month" => 12,
        "exp_year" => 2030,
        "cvc" => "123",
        "holder_name" => "Sam Tester",
      },
    })

    paid = call("GET", "#{SENDMOCK}/wait/payment?provider=stripe&status=succeeded&timeout=10s")

    expect(paid["status"]).to eq("succeeded")
  end
end
```

```csharp tab="C#"
using static SendMock;

public class StripePaymentTests
{
    [Fact]
    public async Task PaysWithATestCard()
    {
        var payment = await Call("POST", Sendmock + "/payments/checkout", new
        {
            provider = "stripe",
            amount_minor = 1999,
            currency = "USD",
        });

        await Call("POST", Sendmock + "/checkout-sessions/" + payment.GetProperty("id").GetString() + "/complete", new
        {
            action = "pay",
            method_key = "card",
            card = new
            {
                number = "4242424242424242",
                exp_month = 12,
                exp_year = 2030,
                cvc = "123",
                holder_name = "Sam Tester",
            },
        });

        var paid = await Call("GET", Sendmock + "/wait/payment?provider=stripe&status=succeeded&timeout=10s");

        Assert.Equal("succeeded", paid.GetProperty("status").GetString());
    }
}
```

## What you should see

The payment **Succeeded** in **Payments**, its timeline with the redirect and the notification, and the notification in **Webhooks > Deliveries**.

## Try it in the demo

1. Open [Payments > Gateways](/demo/payments/gateways) and press **Edit Stripe**.
2. On the **Checkout** tab, press **Open a test checkout**.
3. Fill **Card number** `4242 4242 4242 4242`, **Expiry (MM/YY)** `12/34`, **CVC** `123`, and press the **Pay** button (it shows the amount).
4. The result says "Payment successful".

## Next

- [Payments](../payments/index.md)
- [Checkout page](../payments/checkout-page.md)
