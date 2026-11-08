"""The official Twilio Python SDK against SendMock: an SMS with status callbacks to a local
handler, then a Verify login with the code read from SendMock's API (SM-02.4, VF-03.4)."""

import json
import os
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

from twilio.http.http_client import TwilioHttpClient
from twilio.rest import Client

PROVIDER_URL = os.environ.get("SENDMOCK_PROVIDER_URL", "http://127.0.0.1:8026")
SENDMOCK_URL = os.environ.get("SENDMOCK_URL", "http://127.0.0.1:8025")
RECIPIENT_NUMBER = "+14155550101"
EXPECTED_STATUSES = ["queued", "sent", "delivered"]
CALLBACK_TIMEOUT_SECONDS = 60

received_statuses = []


class SendMockHttpClient(TwilioHttpClient):
    """Sends every Twilio request to SendMock's provider port, keeping its path and query."""

    def request(self, method, url, *args, **kwargs):
        twilio_url = urllib.parse.urlsplit(url)
        sendmock_request_url = urllib.parse.urljoin(
            PROVIDER_URL, urllib.parse.urlunsplit(("", "", twilio_url.path, twilio_url.query, ""))
        )
        return super().request(method, sendmock_request_url, *args, **kwargs)


class StatusCallbackHandler(BaseHTTPRequestHandler):
    """Records the `MessageStatus` of each status callback."""

    def do_POST(self):
        request_body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        received_statuses.append(urllib.parse.parse_qs(request_body).get("MessageStatus", [""])[0])
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


def wait_for_statuses():
    deadline = time.monotonic() + CALLBACK_TIMEOUT_SECONDS
    while len(received_statuses) < len(EXPECTED_STATUSES):
        if time.monotonic() > deadline:
            raise RuntimeError(f"Callbacks so far: {received_statuses}")
        time.sleep(0.25)
    if received_statuses != EXPECTED_STATUSES:
        raise RuntimeError(f"Callbacks out of order: {received_statuses}")


def read_verify_code(phone_number):
    query = urllib.parse.urlencode({"to": phone_number, "channel": "verify"})
    with urllib.request.urlopen(f"{SENDMOCK_URL}/api/v1/otp?{query}") as otp_response:
        return json.load(otp_response)["code"]


client = Client(
    "AC00000000000000000000000000000002",
    "any-auth-token",
    http_client=SendMockHttpClient(),
)

callback_server = HTTPServer(("127.0.0.1", 0), StatusCallbackHandler)
threading.Thread(target=callback_server.serve_forever, daemon=True).start()
callback_url = f"http://127.0.0.1:{callback_server.server_port}/status"
message = client.messages.create(
    from_="+15005550006",
    to=RECIPIENT_NUMBER,
    body="Your order has shipped",
    status_callback=callback_url,
)
print(f"Sent {message.sid} ({message.status})")
wait_for_statuses()
print(f"Status callbacks: {', '.join(received_statuses)}")
callback_server.shutdown()

verify_service = client.verify.v2.services.create(friendly_name="Python shop")
verification = client.verify.v2.services(verify_service.sid).verifications.create(
    to=RECIPIENT_NUMBER, channel="sms"
)
verify_code = read_verify_code(RECIPIENT_NUMBER)
verification_check = client.verify.v2.services(verify_service.sid).verification_checks.create(
    to=RECIPIENT_NUMBER, code=verify_code
)
if verification_check.status != "approved":
    raise RuntimeError(f"Verify login ended {verification_check.status}")
print(f"Verify login {verification.sid} approved with {verify_code}")
