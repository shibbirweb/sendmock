# syntax=docker/dockerfile:1
# The SendMock image (docs/plan/09-distribution.md, Docker): a static musl binary on scratch,
# running as a non-root user with its data in /data.

FROM oven/bun:1.4 AS web-build
WORKDIR /src/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
# The live build: the binary serves the real API, so the mock layer stays out (UI-12.3).
RUN VITE_API_MODE=live bun run build

FROM rust:1.98-alpine AS binary-build
RUN apk add --no-cache gcc musl-dev ca-certificates
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates crates
# The agent skill the binary embeds.
COPY skill skill
COPY --from=web-build /src/web/dist web/dist
ARG SENDMOCK_RELEASE_CHANNEL=edge
RUN SENDMOCK_RELEASE_CHANNEL="$SENDMOCK_RELEASE_CHANNEL" cargo build --release --locked -p sendmock \
    && mkdir -p /image/data /image/config /image/templates /image/tmp \
    && cp target/release/sendmock /image/sendmock \
    && chmod 1777 /image/tmp

# The -debug images: the same binary and layout on distroless's debug base, which has a busybox
# shell (/busybox/sh) for looking around a running container.
FROM gcr.io/distroless/static-debian12:debug AS debug
COPY --from=binary-build /image/sendmock /sendmock
COPY --from=binary-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=binary-build --chown=10001:10001 /image/data /data
COPY --from=binary-build /image/config /config
COPY --from=binary-build /image/templates /templates
COPY --from=binary-build /image/tmp /tmp
ENV SENDMOCK_HTTP_ADDR=0.0.0.0:8025 \
    SENDMOCK_SMTP_ADDR=0.0.0.0:1025 \
    SENDMOCK_DB=/data/sendmock.db \
    SENDMOCK_TEMPLATES_DIR=/templates
LABEL org.opencontainers.image.title="SendMock (debug)" \
      org.opencontainers.image.source="https://github.com/shibbirweb/sendmock" \
      org.opencontainers.image.licenses="MIT OR Apache-2.0" \
      io.modelcontextprotocol.server.name="io.github.shibbirweb/sendmock"
USER 10001:10001
WORKDIR /data
VOLUME ["/data"]
EXPOSE 8025 1025
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --start-interval=1s --retries=3 \
    CMD ["/sendmock", "health"]
ENTRYPOINT ["/sendmock"]

# The image (last, so a plain `docker build` makes it).
FROM scratch
COPY --from=binary-build /image/sendmock /sendmock
# The opt-in update check reaches GitHub over HTTPS; scratch has no certificate store.
COPY --from=binary-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=binary-build --chown=10001:10001 /image/data /data
COPY --from=binary-build /image/config /config
# Template files mounted here load like --templates-dir; an empty folder loads nothing.
COPY --from=binary-build /image/templates /templates
# SQLite writes temporary files to /tmp, which scratch does not have.
COPY --from=binary-build /image/tmp /tmp
ENV SENDMOCK_HTTP_ADDR=0.0.0.0:8025 \
    SENDMOCK_SMTP_ADDR=0.0.0.0:1025 \
    SENDMOCK_DB=/data/sendmock.db \
    SENDMOCK_TEMPLATES_DIR=/templates
LABEL org.opencontainers.image.title="SendMock" \
      org.opencontainers.image.source="https://github.com/shibbirweb/sendmock" \
      org.opencontainers.image.licenses="MIT OR Apache-2.0" \
      io.modelcontextprotocol.server.name="io.github.shibbirweb/sendmock"
USER 10001:10001
WORKDIR /data
VOLUME ["/data"]
EXPOSE 8025 1025
# scratch has no curl, so the binary checks itself.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --start-interval=1s --retries=3 \
    CMD ["/sendmock", "health"]
ENTRYPOINT ["/sendmock"]
