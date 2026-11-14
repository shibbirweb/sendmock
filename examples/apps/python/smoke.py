"""An app's test on Python's standard library: it sends an email and reads its code, sends an
SMS and waits for it, and captures an outgoing HTTP call, all against a running SendMock."""

import json
import os
import urllib.parse
import urllib.request

SENDMOCK_URL = os.environ.get("SENDMOCK_URL", "http://127.0.0.1:8025")


def call(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(f"{SENDMOCK_URL}{path}", data=data, method=method)
    if body is not None:
        request.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read() or b"null")


def expect_equal(actual, expected, what):
    if actual != expected:
        raise SystemExit(f"{what}: expected {expected!r}, got {actual!r}")


call("POST", "/api/v1/send", {"from": "app@shop.test", "to": ["python@example.test"], "subject": "Your code", "text": "Your code is 482913"})
otp = call("GET", "/api/v1/otp?" + urllib.parse.urlencode({"to": "python@example.test", "timeout": "10s"}))
expect_equal(otp["code"], "482913", "The code in the email")

call("POST", "/api/v1/sms", {"from": "+15550001111", "to": "+15550002222", "body": "Hello from Python"})
sms = call("GET", "/api/v1/wait/sms?" + urllib.parse.urlencode({"to": "+15550002222", "timeout": "10s"}))
expect_equal(sms["body"], "Hello from Python", "The SMS body")

call("POST", "/catch/python-orders/orders", {"order": 42})
captured = call("GET", "/api/v1/wait/http?" + urllib.parse.urlencode({"bin": "python-orders", "timeout": "10s"}))
expect_equal(captured["method"], "POST", "The captured request's method")
expect_equal('"order": 42' in captured["body"] or '"order":42' in captured["body"], True, "The captured body")

print("Python: email, SMS and HTTP capture all work.")
