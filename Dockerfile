# syntax=docker/dockerfile:1
# The SendMock image (docs/plan/09-distribution.md, Docker): a static musl binary on scratch,
# running as a non-root user with its data in /data.

FROM oven/bun:1.4 AS web-build
WORKDIR /src/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

FROM rust:1.98-alpine AS binary-build
RUN apk add --no-cache gcc musl-dev
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates crates
COPY --from=web-build /src/web/dist web/dist
ARG SENDMOCK_RELEASE_CHANNEL=edge
RUN SENDMOCK_RELEASE_CHANNEL="$SENDMOCK_RELEASE_CHANNEL" cargo build --release --locked -p sendmock \
    && mkdir -p /image/data /image/config /image/tmp \
    && cp target/release/sendmock /image/sendmock \
    && chmod 1777 /image/tmp

FROM scratch
COPY --from=binary-build /image/sendmock /sendmock
COPY --from=binary-build --chown=10001:10001 /image/data /data
COPY --from=binary-build /image/config /config
# SQLite writes temporary files to /tmp, which scratch does not have.
COPY --from=binary-build /image/tmp /tmp
ENV SENDMOCK_HTTP_ADDR=0.0.0.0:8025 \
    SENDMOCK_SMTP_ADDR=0.0.0.0:1025 \
    SENDMOCK_DB=/data/sendmock.db
USER 10001:10001
WORKDIR /data
VOLUME ["/data"]
EXPOSE 8025 1025
# scratch has no curl, so the binary checks itself.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --start-interval=1s --retries=3 \
    CMD ["/sendmock", "health"]
ENTRYPOINT ["/sendmock"]
