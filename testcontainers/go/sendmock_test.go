package sendmock

import (
	"bufio"
	"context"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func imageUnderTest() string {
	if image := os.Getenv("SENDMOCK_IMAGE"); image != "" {
		return image
	}

	return DefaultImage
}

func readSMTPGreeting(t *testing.T, smtpAddress string) string {
	t.Helper()
	smtpConnection, err := net.Dial("tcp", smtpAddress)
	if err != nil {
		t.Fatalf("connect to SMTP: %v", err)
	}
	defer smtpConnection.Close()
	smtpGreeting, err := bufio.NewReader(smtpConnection).ReadString('\n')
	if err != nil {
		t.Fatalf("read the SMTP greeting: %v", err)
	}

	return smtpGreeting
}

// DS-06.1
func TestRunGivesTheSMTPHTTPAndProviderAddresses(t *testing.T) {
	ctx := context.Background()
	sendmockContainer, err := Run(ctx, imageUnderTest())
	testcontainers.CleanupContainer(t, sendmockContainer)
	if err != nil {
		t.Fatal(err)
	}
	httpURL, _ := sendmockContainer.HTTPURL(ctx)
	providerURL, _ := sendmockContainer.ProviderURL(ctx)
	smtpAddress, _ := sendmockContainer.SMTPAddress(ctx)

	healthResponse, err := http.Get(httpURL + "/api/v1/health")
	if err != nil {
		t.Fatal(err)
	}
	healthResponse.Body.Close()
	twilioResponse, err := http.PostForm(
		providerURL+"/2010-04-01/Accounts/AC00000000000000000000000000000006/Messages.json",
		url.Values{"From": {"+15005550006"}, "To": {"+14155550105"}, "Body": {"From Go"}},
	)
	if err != nil {
		t.Fatal(err)
	}
	twilioResponse.Body.Close()
	smtpGreeting := readSMTPGreeting(t, smtpAddress)

	if healthResponse.StatusCode != http.StatusOK {
		t.Errorf("health answered %d", healthResponse.StatusCode)
	}
	if twilioResponse.StatusCode != http.StatusCreated {
		t.Errorf("the Twilio send answered %d", twilioResponse.StatusCode)
	}
	if !strings.HasPrefix(smtpGreeting, "220 ") {
		t.Errorf("SMTP greeted with %q", smtpGreeting)
	}
}
