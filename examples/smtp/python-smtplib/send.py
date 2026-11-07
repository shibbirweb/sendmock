"""Python's standard smtplib, as a script or a Flask app uses it."""

import os
import smtplib
from email.message import EmailMessage

message = EmailMessage()
message["From"] = "App <app@python.test>"
message["To"] = "user@example.test"
message["Subject"] = os.environ.get("SUBJECT", "From smtplib")
message.set_content("Your code is 482913")

with smtplib.SMTP(os.environ.get("SMTP_HOST", "127.0.0.1"), int(os.environ.get("SMTP_PORT", "1025"))) as smtp:
    smtp.send_message(message)
