// An app's test on Go's own net/http: it sends an email and reads its code, sends an SMS and
// waits for it, and captures an outgoing HTTP call, all against a running SendMock.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

var sendmockURL = readSendmockURL()
var httpClient = &http.Client{Timeout: 30 * time.Second}

func readSendmockURL() string {
	if configuredURL := os.Getenv("SENDMOCK_URL"); configuredURL != "" {
		return configuredURL
	}
	return "http://127.0.0.1:8025"
}

func call(method, path string, body any) map[string]any {
	var requestBody io.Reader
	if body != nil {
		encodedBody, _ := json.Marshal(body)
		requestBody = bytes.NewReader(encodedBody)
	}
	request, _ := http.NewRequest(method, sendmockURL+path, requestBody)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, requestError := httpClient.Do(request)
	if requestError != nil {
		fail("%s %s failed: %v", method, path, requestError)
	}
	defer response.Body.Close()
	answerBytes, _ := io.ReadAll(response.Body)
	if response.StatusCode >= 300 {
		fail("%s %s answered %d: %s", method, path, response.StatusCode, answerBytes)
	}
	answer := map[string]any{}
	_ = json.Unmarshal(answerBytes, &answer)
	return answer
}

func fail(format string, values ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", values...)
	os.Exit(1)
}

func expectEqual(actual, expected any, what string) {
	if actual != expected {
		fail("%s: expected %v, got %v", what, expected, actual)
	}
}

func main() {
	call("POST", "/api/v1/send", map[string]any{"from": "app@shop.test", "to": []string{"go@example.test"}, "subject": "Your code", "text": "Your code is 482913"})
	otp := call("GET", "/api/v1/otp?"+url.Values{"to": {"go@example.test"}, "timeout": {"10s"}}.Encode(), nil)
	expectEqual(otp["code"], "482913", "The code in the email")

	call("POST", "/api/v1/sms", map[string]any{"from": "+15550001111", "to": "+15550002222", "body": "Hello from Go"})
	sms := call("GET", "/api/v1/wait/sms?"+url.Values{"to": {"+15550002222"}, "timeout": {"10s"}}.Encode(), nil)
	expectEqual(sms["body"], "Hello from Go", "The SMS body")

	call("POST", "/catch/go-orders/orders", map[string]any{"order": 42})
	captured := call("GET", "/api/v1/wait/http?"+url.Values{"bin": {"go-orders"}, "timeout": {"10s"}}.Encode(), nil)
	expectEqual(captured["method"], "POST", "The captured request's method")
	capturedBody, _ := captured["body"].(string)
	expectEqual(strings.Contains(capturedBody, `"order":42`), true, "The captured body")

	fmt.Println("Go: email, SMS and HTTP capture all work.")
}
