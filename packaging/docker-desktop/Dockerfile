# The SendMock Docker Desktop extension (docs/plan/32-after-1-0.md, A10): metadata, icon, the
# Compose file for the SendMock backend and a one-page dashboard tab. Docker Desktop lists an
# extension only when every required label below is set.
FROM scratch
LABEL org.opencontainers.image.title="SendMock" \
      org.opencontainers.image.description="Catch the email, SMS, push notifications, payments and webhooks your app sends, and see them in a web UI." \
      org.opencontainers.image.vendor="SendMock" \
      org.opencontainers.image.source="https://github.com/shibbirweb/sendmock" \
      org.opencontainers.image.licenses="MIT OR Apache-2.0" \
      com.docker.desktop.extension.api.version="0.3.4" \
      com.docker.desktop.extension.icon="https://shibbirweb.github.io/sendmock/icon.svg" \
      com.docker.extension.screenshots='[{"alt":"The SendMock inbox","url":"https://shibbirweb.github.io/sendmock/screenshots/mail-light.jpg"},{"alt":"SMS conversations","url":"https://shibbirweb.github.io/sendmock/screenshots/sms-light.jpg"}]' \
      com.docker.extension.detailed-description="<p>SendMock runs a local SMTP server and provider APIs (Twilio, SendGrid, Stripe, FCM and more) that catch what your app sends, and shows it in a web UI: emails with previews and checks, SMS conversations, push notifications, payments and the webhooks it sends back.</p><p>Point your app at <code>localhost:1025</code> for SMTP and open the web UI from this tab.</p>" \
      com.docker.extension.publisher-url="https://github.com/shibbirweb/sendmock" \
      com.docker.extension.additional-urls='[{"title":"Documentation","url":"https://shibbirweb.github.io/sendmock/docs/"},{"title":"Report an issue","url":"https://github.com/shibbirweb/sendmock/issues"}]' \
      com.docker.extension.changelog="<p>The first version of the extension: SendMock as its backend, and a tab that shows its status and opens the web UI.</p>" \
      com.docker.extension.categories="testing-tools"
COPY metadata.json sendmock.svg docker-compose.yaml /
COPY ui /ui
