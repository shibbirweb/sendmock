// The official Twilio Go SDK against SendMock: an SMS with status callbacks to a local
// handler, then a Verify login with the code read from SendMock's API (SM-02.4).
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/twilio/twilio-go"
	twilioclient "github.com/twilio/twilio-go/client"
	messaging "github.com/twilio/twilio-go/rest/api/v2010"
	verify "github.com/twilio/twilio-go/rest/verify/v2"
)

const (
	accountSid      = "AC00000000000000000000000000000004"
	recipientNumber = "+14155550103"
	callbackTimeout = 60 * time.Second
)

var expectedStatuses = []string{"queued", "sent", "delivered"}

// providerPortTransport sends every Twilio request to SendMock's provider port, keeping its
// path and query.
type providerPortTransport struct {
	providerURL *url.URL
}

func (transport providerPortTransport) RoundTrip(twilioRequest *http.Request) (*http.Response, error) {
	sendmockRequest := twilioRequest.Clone(twilioRequest.Context())
	sendmockRequest.URL.Scheme = transport.providerURL.Scheme
	sendmockRequest.URL.Host = transport.providerURL.Host
	sendmockRequest.Host = transport.providerURL.Host
	return http.DefaultTransport.RoundTrip(sendmockRequest)
}

// statusRecorder keeps the `MessageStatus` of each status callback.
type statusRecorder struct {
	mutex            sync.Mutex
	receivedStatuses []string
}

func (recorder *statusRecorder) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	if err := request.ParseForm(); err != nil {
		http.Error(response, err.Error(), http.StatusBadRequest)
		return
	}
	recorder.mutex.Lock()
	recorder.receivedStatuses = append(recorder.receivedStatuses, request.PostForm.Get("MessageStatus"))
	recorder.mutex.Unlock()
	response.WriteHeader(http.StatusNoContent)
}

func (recorder *statusRecorder) statusesSoFar() []string {
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	return slices.Clone(recorder.receivedStatuses)
}

func (recorder *statusRecorder) waitForStatuses() error {
	deadline := time.Now().Add(callbackTimeout)
	for len(recorder.statusesSoFar()) < len(expectedStatuses) {
		if time.Now().After(deadline) {
			return fmt.Errorf("callbacks so far: %v", recorder.statusesSoFar())
		}
		time.Sleep(250 * time.Millisecond)
	}
	if !slices.Equal(recorder.statusesSoFar(), expectedStatuses) {
		return fmt.Errorf("callbacks out of order: %v", recorder.statusesSoFar())
	}
	return nil
}

func readVerifyCode(sendmockURL string, phoneNumber string) (string, error) {
	query := url.Values{"to": {phoneNumber}, "channel": {"verify"}}
	otpResponse, err := http.Get(sendmockURL + "/api/v1/otp?" + query.Encode())
	if err != nil {
		return "", err
	}
	defer otpResponse.Body.Close()
	if otpResponse.StatusCode != http.StatusOK {
		return "", fmt.Errorf("no Verify code for %s: %d", phoneNumber, otpResponse.StatusCode)
	}
	var otpBody struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(otpResponse.Body).Decode(&otpBody); err != nil {
		return "", err
	}
	return otpBody.Code, nil
}

func environmentOrDefault(variableName string, defaultValue string) string {
	if value := os.Getenv(variableName); value != "" {
		return value
	}
	return defaultValue
}

func newSendMockTwilioClient(providerURL string) (*twilio.RestClient, error) {
	parsedProviderURL, err := url.Parse(providerURL)
	if err != nil {
		return nil, err
	}
	baseClient := &twilioclient.Client{
		// twilio-go refuses an auth token with anything but letters and digits (error 21224).
		Credentials: twilioclient.NewCredentials(accountSid, "anyauthtoken"),
		HTTPClient:  &http.Client{Transport: providerPortTransport{providerURL: parsedProviderURL}},
	}
	baseClient.SetAccountSid(accountSid)
	return twilio.NewRestClientWithParams(twilio.ClientParams{Client: baseClient}), nil
}

func sendWithStatusCallbacks(client *twilio.RestClient) error {
	recorder := &statusRecorder{}
	callbackListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	callbackServer := &http.Server{Handler: recorder}
	go callbackServer.Serve(callbackListener)
	defer callbackServer.Close()

	messageParams := &messaging.CreateMessageParams{}
	messageParams.SetTo(recipientNumber).
		SetFrom("+15005550006").
		SetBody("Your order has shipped").
		SetStatusCallback("http://" + callbackListener.Addr().String() + "/status")
	message, err := client.Api.CreateMessage(messageParams)
	if err != nil {
		return err
	}
	fmt.Printf("Sent %s (%s)\n", *message.Sid, *message.Status)
	if err := recorder.waitForStatuses(); err != nil {
		return err
	}
	fmt.Printf("Status callbacks: %s\n", strings.Join(recorder.statusesSoFar(), ", "))
	return nil
}

func runVerifyLogin(client *twilio.RestClient, sendmockURL string) error {
	serviceParams := &verify.CreateServiceParams{}
	verifyService, err := client.VerifyV2.CreateService(serviceParams.SetFriendlyName("Go shop"))
	if err != nil {
		return err
	}
	verificationParams := &verify.CreateVerificationParams{}
	verification, err := client.VerifyV2.CreateVerification(
		*verifyService.Sid,
		verificationParams.SetTo(recipientNumber).SetChannel("sms"),
	)
	if err != nil {
		return err
	}
	verifyCode, err := readVerifyCode(sendmockURL, recipientNumber)
	if err != nil {
		return err
	}
	checkParams := &verify.CreateVerificationCheckParams{}
	verificationCheck, err := client.VerifyV2.CreateVerificationCheck(
		*verifyService.Sid,
		checkParams.SetTo(recipientNumber).SetCode(verifyCode),
	)
	if err != nil {
		return err
	}
	if *verificationCheck.Status != "approved" {
		return fmt.Errorf("verify login ended %s", *verificationCheck.Status)
	}
	fmt.Printf("Verify login %s approved with %s\n", *verification.Sid, verifyCode)
	return nil
}

func main() {
	providerURL := environmentOrDefault("SENDMOCK_PROVIDER_URL", "http://127.0.0.1:8026")
	sendmockURL := environmentOrDefault("SENDMOCK_URL", "http://127.0.0.1:8025")
	client, err := newSendMockTwilioClient(providerURL)
	if err != nil {
		log.Fatal(err)
	}
	if err := sendWithStatusCallbacks(client); err != nil {
		log.Fatal(err)
	}
	if err := runVerifyLogin(client, sendmockURL); err != nil {
		log.Fatal(err)
	}
}
