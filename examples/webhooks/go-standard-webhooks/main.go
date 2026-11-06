// The official Standard Webhooks library for Go verifies a native delivery from SendMock: a
// rule sends an email.received webhook to a local receiver, which checks the signature with
// the endpoint's whsec_ secret and refuses a tampered body (WH-04.1).
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	standardwebhooks "github.com/standard-webhooks/standard-webhooks/libraries/go"
)

const deliveryTimeout = 30 * time.Second

// receivedDelivery is a webhook as the receiver got it.
type receivedDelivery struct {
	rawBody []byte
	headers http.Header
}

func environmentOrDefault(variableName string, defaultValue string) string {
	if value := os.Getenv(variableName); value != "" {
		return value
	}
	return defaultValue
}

func callSendMock(sendmockURL string, method string, path string, requestBody any) (map[string]any, error) {
	var requestReader io.Reader
	if requestBody != nil {
		encodedBody, err := json.Marshal(requestBody)
		if err != nil {
			return nil, err
		}
		requestReader = bytes.NewReader(encodedBody)
	}
	sendmockRequest, err := http.NewRequest(method, sendmockURL+"/api/v1"+path, requestReader)
	if err != nil {
		return nil, err
	}
	sendmockRequest.Header.Set("Content-Type", "application/json")
	sendmockResponse, err := http.DefaultClient.Do(sendmockRequest)
	if err != nil {
		return nil, err
	}
	defer sendmockResponse.Body.Close()
	responseBody, err := io.ReadAll(sendmockResponse.Body)
	if err != nil {
		return nil, err
	}
	if sendmockResponse.StatusCode >= 300 {
		return nil, fmt.Errorf("%s %s answered %d: %s", method, path, sendmockResponse.StatusCode, responseBody)
	}
	answer := map[string]any{}
	return answer, json.Unmarshal(responseBody, &answer)
}

// startDeliveryReceiver serves a local app that hands over the first webhook it receives.
func startDeliveryReceiver() (string, <-chan receivedDelivery, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", nil, err
	}
	deliveries := make(chan receivedDelivery, 1)
	receiver := http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		rawBody, _ := io.ReadAll(request.Body)
		select {
		case deliveries <- receivedDelivery{rawBody: rawBody, headers: request.Header.Clone()}:
		default:
		}
		response.WriteHeader(http.StatusNoContent)
	})
	go http.Serve(listener, receiver)
	return "http://" + listener.Addr().String() + "/webhooks", deliveries, nil
}

// connectEndpoint adds an endpoint for the receiver and a rule for every received email, and
// answers the endpoint's secret.
func connectEndpoint(sendmockURL string, receiverURL string) (string, error) {
	endpoint, err := callSendMock(sendmockURL, "POST", "/webhooks/endpoints", map[string]any{
		"name": "Go verifier", "url": receiverURL, "method": "POST",
		"headers": map[string]any{}, "extra_fields": map[string]any{},
		"template_id": "native", "template_mode": "linked", "timeout_ms": 10000,
		"retry_policy": map[string]any{
			"max_attempts": 1, "backoff_seconds": []int{1}, "retry_on_client_errors": false,
		},
		"is_enabled": true, "query_params": []any{}, "body_mode": "template", "body_fields": []any{},
		"fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
		"render_mode": "strict",
	})
	if err != nil {
		return "", err
	}
	endpointID := fmt.Sprint(endpoint["id"])
	if _, err := callSendMock(sendmockURL, "POST", "/webhooks/rules", map[string]any{
		"name": "Every received email", "endpoint_id": endpointID,
		"events": []string{"email.received"}, "filter": nil, "is_enabled": true,
	}); err != nil {
		return "", err
	}
	revealedSecret, err := callSendMock(sendmockURL, "GET", "/webhooks/endpoints/"+endpointID+"/secret", nil)
	if err != nil {
		return "", err
	}
	return fmt.Sprint(revealedSecret["secret"]), nil
}

func verifyDelivery(webhookSecret string, delivery receivedDelivery) error {
	webhook, err := standardwebhooks.NewWebhook(webhookSecret)
	if err != nil {
		return err
	}
	if err := webhook.Verify(delivery.rawBody, delivery.headers); err != nil {
		return fmt.Errorf("the delivery did not verify: %w", err)
	}
	var verifiedEvent struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(delivery.rawBody, &verifiedEvent); err != nil {
		return err
	}
	if verifiedEvent.Type != "email.received" {
		return fmt.Errorf("unexpected event %s", verifiedEvent.Type)
	}
	tamperedBody := append(bytes.Clone(delivery.rawBody), ' ')
	if webhook.Verify(tamperedBody, delivery.headers) == nil {
		return errors.New("a tampered body passed verification")
	}
	fmt.Printf("Verified %s (%s) with the Go standard-webhooks library; a tampered body is refused.\n",
		delivery.headers.Get("webhook-id"), verifiedEvent.Type)
	return nil
}

func run() error {
	sendmockURL := environmentOrDefault("SENDMOCK_URL", "http://127.0.0.1:8025")
	receiverURL, deliveries, err := startDeliveryReceiver()
	if err != nil {
		return err
	}
	webhookSecret, err := connectEndpoint(sendmockURL, receiverURL)
	if err != nil {
		return err
	}
	if _, err := callSendMock(sendmockURL, "POST", "/send", map[string]any{
		"from": "shop@example.test", "to": []string{"sam@example.test"},
		"subject": "Signed by SendMock", "text": "Hello",
	}); err != nil {
		return err
	}
	select {
	case delivery := <-deliveries:
		return verifyDelivery(webhookSecret, delivery)
	case <-time.After(deliveryTimeout):
		return errors.New("no webhook arrived")
	}
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
