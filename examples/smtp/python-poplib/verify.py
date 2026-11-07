"""Python's poplib reads the mail SendMock caught (EM-21.6): /api/v1/info names the POP3 port,
a login reads the Default mailbox, and a project's key as the username reads only that project.

AC: EM-21.6
"""

import json
import os
import poplib
import smtplib
import urllib.request
from email.message import EmailMessage

SENDMOCK_URL = os.environ.get("SENDMOCK_URL", "http://127.0.0.1:8025")
SMTP_HOST = os.environ.get("SMTP_HOST", "127.0.0.1")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "1025"))
POP3_PORT = 1110


def read_json(path: str, payload: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"{SENDMOCK_URL}{path}",
        data=None if payload is None else json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def send_email(subject: str, smtp_username: str | None) -> None:
    message = EmailMessage()
    message["From"] = "App <app@poplib.test>"
    message["To"] = "reader@example.test"
    message["Subject"] = subject
    message.set_content("Read me over POP3.")
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        if smtp_username is not None:
            smtp.login(smtp_username, "any-password")
        smtp.send_message(message)


def read_subjects(username: str) -> list[str]:
    mailbox = poplib.POP3("127.0.0.1", POP3_PORT, timeout=10)
    try:
        mailbox.user(username)
        mailbox.pass_("any-password")
        message_count, _ = mailbox.stat()
        subjects = []
        for message_number in range(1, message_count + 1):
            _, message_lines, _ = mailbox.retr(message_number)
            subject_line = next(
                line.decode() for line in message_lines if line.lower().startswith(b"subject:")
            )
            subjects.append(subject_line.split(":", 1)[1].strip())
        return subjects
    finally:
        mailbox.quit()


def main() -> None:
    app_info = read_json("/api/v1/info")
    assert app_info["pop3_address"] == f"127.0.0.1:{POP3_PORT}", app_info["pop3_address"]
    read_json("/api/v1/projects", {"key": "poplib-shop", "name": "Poplib shop"})

    send_email("For the default mailbox", None)
    send_email("For the shop mailbox", "poplib-shop")

    default_subjects = read_subjects("anyone")
    shop_subjects = read_subjects("poplib-shop")
    assert "For the default mailbox" in default_subjects, default_subjects
    assert "For the shop mailbox" not in default_subjects, default_subjects
    assert shop_subjects == ["For the shop mailbox"], shop_subjects
    print(f"poplib read {len(default_subjects)} default and {len(shop_subjects)} shop messages")


if __name__ == "__main__":
    main()
