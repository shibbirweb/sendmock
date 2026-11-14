"""The official Standard Webhooks library for Python verifies a native delivery from SendMock:
a rule sends an email.received webhook to a local receiver, which checks the signature with
the endpoint's whsec_ secret and refuses a tampered body (WH-04.1)."""

import json
import os
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

from standardwebhooks.webhooks import Webhook, WebhookVerificationError

SENDMOCK_URL = os.environ.get("SENDMOCK_URL", "http://127.0.0.1:8025")
DELIVERY_TIMEOUT_SECONDS = 30

received_delivery = {}
delivery_arrived = threading.Event()


class DeliveryReceiver(BaseHTTPRequestHandler):
    """Keeps the first webhook it receives, body and headers as sent."""

    def do_POST(self):
        raw_body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        if not delivery_arrived.is_set():
            received_delivery["raw_body"] = raw_body
            received_delivery["headers"] = {
                header_name.lower(): header_value for header_name, header_value in self.headers.items()
            }
            delivery_arrived.set()
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


def call_sendmock(method, path, request_body=None):
    request_data = None if request_body is None else json.dumps(request_body).encode()
    sendmock_request = urllib.request.Request(
        f"{SENDMOCK_URL}/api/v1{path}",
        data=request_data,
        method=method,
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(sendmock_request) as sendmock_response:
        return json.load(sendmock_response)


def connect_endpoint(receiver_url):
    """An endpoint for the receiver with a rule for every received email; answers its secret."""
    endpoint = call_sendmock(
        "POST",
        "/webhooks/endpoints",
        {
            "name": "Python verifier",
            "url": receiver_url,
            "method": "POST",
            "headers": {},
            "extra_fields": {},
            "template_id": "native",
            "template_mode": "linked",
            "timeout_ms": 10000,
            "retry_policy": {"max_attempts": 1, "backoff_seconds": [1], "retry_on_client_errors": False},
            "is_enabled": True,
            "query_params": [],
            "body_mode": "template",
            "body_fields": [],
            "fields_encoding": "json",
            "raw_content_type": "application/json",
            "raw_body": "",
            "render_mode": "strict",
        },
    )
    call_sendmock(
        "POST",
        "/webhooks/rules",
        {
            "name": "Every received email",
            "endpoint_id": endpoint["id"],
            "events": ["email.received"],
            "filter": None,
            "is_enabled": True,
        },
    )
    return call_sendmock("GET", f"/webhooks/endpoints/{endpoint['id']}/secret")["secret"]


receiver = HTTPServer(("127.0.0.1", 0), DeliveryReceiver)
threading.Thread(target=receiver.serve_forever, daemon=True).start()
webhook_secret = connect_endpoint(f"http://127.0.0.1:{receiver.server_port}/webhooks")
call_sendmock(
    "POST",
    "/send",
    {"from": "shop@example.test", "to": ["sam@example.test"], "subject": "Signed by SendMock", "text": "Hello"},
)
if not delivery_arrived.wait(DELIVERY_TIMEOUT_SECONDS):
    raise RuntimeError("No webhook arrived")
receiver.shutdown()

webhook = Webhook(webhook_secret)
verified_event = webhook.verify(received_delivery["raw_body"], received_delivery["headers"])
if verified_event["type"] != "email.received":
    raise RuntimeError(f"Unexpected event {verified_event['type']}")
try:
    webhook.verify(received_delivery["raw_body"] + " ", received_delivery["headers"])
    raise RuntimeError("A tampered body passed verification")
except WebhookVerificationError:
    pass
print(
    f"Verified {received_delivery['headers']['webhook-id']} ({verified_event['type']}) "
    "with standardwebhooks; a tampered body is refused."
)
