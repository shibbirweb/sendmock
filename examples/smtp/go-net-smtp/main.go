// Go's standard net/smtp, without TLS or AUTH, as a local setup sends.
package main

import (
	"log"
	"net/smtp"
	"os"
)

func readSetting(name, defaultValue string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	address := readSetting("SMTP_HOST", "127.0.0.1") + ":" + readSetting("SMTP_PORT", "1025")
	subject := readSetting("SUBJECT", "From net/smtp")
	message := "From: App <app@go.test>\r\n" +
		"To: user@example.test\r\n" +
		"Subject: " + subject + "\r\n" +
		"\r\n" +
		"Your code is 482913\r\n"
	if err := smtp.SendMail(address, nil, "app@go.test", []string{"user@example.test"}, []byte(message)); err != nil {
		log.Fatal(err)
	}
}
