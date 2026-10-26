---
title: Go
description: Connect Go apps to SendMock with net/smtp and net/http.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

## Email

```go
err := smtp.SendMail("127.0.0.1:1025", nil, from, []string{to}, message)
```

## SMS

```go
payload := strings.NewReader(`{"from":"+15550001111","to":"+8801700000000","body":"Your code is 482913"}`)
resp, err := http.Post("http://127.0.0.1:8025/api/v1/sms", "application/json", payload)
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms/index.md) and [Email](../mail/index.md) pages list the providers.

## Test helper

Save this as `sendmock_test.go`. The code examples in the [recipes](../recipes/index.md) use it to call SendMock and your app.

```go title="sendmock_test.go"
package app_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

const sendmock = "http://127.0.0.1:8025/api/v1"
const app = "http://localhost:8080"

// call calls SendMock or your app and returns the JSON answer, or nil when there is none.
func call(t *testing.T, method, url string, body any) any {
	t.Helper()
	var payload bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&payload).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	request, err := http.NewRequest(method, url, &payload)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode >= 400 {
		t.Fatalf("%s %s answered %d", method, url, response.StatusCode)
	}
	if !strings.Contains(response.Header.Get("Content-Type"), "json") {
		return nil
	}
	var answer any
	if err := json.NewDecoder(response.Body).Decode(&answer); err != nil {
		t.Fatal(err)
	}
	return answer
}
```
