"""Django's mail API with the settings a project points at SendMock."""

import os

import django
from django.conf import settings

settings.configure(
    EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
    EMAIL_HOST=os.environ.get("SMTP_HOST", "127.0.0.1"),
    EMAIL_PORT=int(os.environ.get("SMTP_PORT", "1025")),
    DEFAULT_FROM_EMAIL="App <app@django.test>",
)
django.setup()

from django.core.mail import send_mail  # noqa: E402 (needs the settings above)

send_mail(os.environ.get("SUBJECT", "From Django"), "Your code is 482913", None, ["user@example.test"])
