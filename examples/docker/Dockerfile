# The stand-in app of the Compose example: it sends one email over SMTP and one SMS through the
# API to the `sendmock` service, as an app in the same Compose project would.
FROM python:3.13-alpine
COPY app/send_messages.py /send_messages.py
CMD ["python", "/send_messages.py"]
