"""The Phase 1 done-when check: a pytest test sends mail and reads the code back from SendMock."""

import json
import os
import smtplib
import urllib.parse
import urllib.request
from email.message import EmailMessage

SENDMOCK_URL = os.environ.get("SENDMOCK_URL", "http://127.0.0.1:8025")
RECIPIENT = "pytest@example.test"


def send_signup_email() -> None:
    message = EmailMessage()
    message["From"] = "App <app@pytest.test>"
    message["To"] = RECIPIENT
    message["Subject"] = "Your sign-up code"
    message.set_content("Welcome! Your code is 482913.")
    with smtplib.SMTP(os.environ.get("SMTP_HOST", "127.0.0.1"), int(os.environ.get("SMTP_PORT", "1025"))) as smtp:
        smtp.send_message(message)


def test_the_sign_up_code_can_be_read_through_the_otp_api() -> None:
    send_signup_email()

    query = urllib.parse.urlencode({"to": RECIPIENT, "timeout": "5s"})
    with urllib.request.urlopen(f"{SENDMOCK_URL}/api/v1/otp?{query}") as response:
        extracted_code = json.load(response)

    assert extracted_code["code"] == "482913"
