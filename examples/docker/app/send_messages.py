"""Sends one email and one SMS to SendMock with the settings the Compose example gives the app."""

import json
import os
import smtplib
import urllib.request
from email.message import EmailMessage

mail_host = os.environ.get("MAIL_HOST", "sendmock")
mail_port = int(os.environ.get("MAIL_PORT", "1025"))

email_message = EmailMessage()
email_message["From"] = "app@example.test"
email_message["To"] = "compose@example.test"
email_message["Subject"] = "Sent from the Compose example"
email_message.set_content("The app container reached SendMock by its service name.")
with smtplib.SMTP(mail_host, mail_port, timeout=10) as smtp_connection:
    smtp_connection.send_message(email_message)

sms_request = urllib.request.Request(
    f"http://{mail_host}:8025/api/v1/sms",
    data=json.dumps(
        {"from": "+15550001111", "to": "+15550002222", "body": "Sent from the Compose example"}
    ).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(sms_request, timeout=10) as sms_response:
    print("SMS sent:", sms_response.status)
print("Email sent to compose@example.test")
