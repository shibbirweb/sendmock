# Docker examples

The files the [Docker](../../docs/wiki/connect/docker.md) page shows, run by the "Docker examples" workflow so the page stays true:

- `compose.yaml`: the page's whole `compose.yaml`, with SendMock and an app that waits for its health check.
- `Dockerfile` and `app/send_messages.py`: the stand-in app, which sends one email over SMTP to `sendmock:1025` and one SMS through the API.

Run it:

1. Start both services:

   ```bash
   docker compose up --build
   ```

2. Open http://127.0.0.1:8025 and find the email and the SMS.
