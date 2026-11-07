import os
import socket
import urllib.parse
import urllib.request

from sendmock_testcontainers import DEFAULT_IMAGE, SendMockContainer


def read_smtp_greeting(smtp_host, smtp_port):
    with socket.create_connection((smtp_host, smtp_port), timeout=10) as smtp_socket:
        return smtp_socket.recv(512).decode("ascii")


# DS-06.1
def test_starts_the_image_and_gives_the_smtp_http_and_provider_addresses():
    with SendMockContainer(os.environ.get("SENDMOCK_IMAGE", DEFAULT_IMAGE)) as sendmock:
        with urllib.request.urlopen(f"{sendmock.get_http_url()}/api/v1/health") as health_response:
            health_status = health_response.status
        twilio_form = urllib.parse.urlencode(
            {"From": "+15005550006", "To": "+14155550104", "Body": "From Python"}
        ).encode()
        twilio_request = urllib.request.Request(
            f"{sendmock.get_provider_url()}/2010-04-01/Accounts/AC00000000000000000000000000000005/Messages.json",
            data=twilio_form,
        )
        with urllib.request.urlopen(twilio_request) as twilio_response:
            twilio_status = twilio_response.status
        smtp_greeting = read_smtp_greeting(sendmock.get_smtp_host(), sendmock.get_smtp_port())

    assert health_status == 200
    assert twilio_status == 201
    assert smtp_greeting.startswith("220 ")
