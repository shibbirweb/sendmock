#!/usr/bin/env bash
# Checks a built SendMock image before it is pushed (DS-02.1, DS-02.2, DS-02.3, DS-02.5):
# non-root, data in /data, healthy once listening, the notice about listening without UI auth,
# a clean stop on SIGTERM, a mounted /config/sendmock.toml, /config/sendmock.seed.toml and
# /templates loaded, and under 25 MB compressed. The debug variant must have a shell; the plain
# image must not.
#
#     scripts/docker-image-test.sh <image> [plain|debug]
set -euo pipefail

image="$1"
variant="${2:-plain}"
host_port=18025
mounted_host_port=18026
maximum_compressed_bytes=26214400

fail() {
  echo "Failed: $1" >&2
  exit 1
}

pass() {
  echo "ok   $1"
}

# AC: DS-02.1
[ "$(docker image inspect --format '{{.Config.User}}' "$image")" = "10001:10001" ] || fail "the image runs as UID 10001"
pass "the image runs as UID 10001, not root"

container_id="$(docker run -d -p "127.0.0.1:$host_port:8025" "$image")"
trap 'docker rm -f "$container_id" > /dev/null 2>&1 || true' EXIT

# AC: DS-02.2
health_status="starting"
for _ in $(seq 1 60); do
  health_status="$(docker inspect --format '{{.State.Health.Status}}' "$container_id")"
  [ "$health_status" = "healthy" ] && break
  sleep 1
done
[ "$health_status" = "healthy" ] || fail "the HEALTHCHECK reports healthy (it reports $health_status)"
pass "the HEALTHCHECK reports healthy once listening"

app_info="$(curl -fsS "http://127.0.0.1:$host_port/api/v1/info")"
echo "$app_info" | grep -q '"database_path":"/data/sendmock.db"' || fail "the database is in /data: $app_info"
# AC: UI-04.3 (the UI defaults its connect hints to the Compose host when this is true)
echo "$app_info" | grep -q '"is_container":true' || fail "it knows it runs in a container: $app_info"
pass "the database is /data/sendmock.db and it knows it runs in a container"

curl -fsS "http://127.0.0.1:$host_port/" | grep -q 'id="root"' || fail "the embedded UI is served"
pass "the embedded UI is served"

docker logs "$container_id" | grep -q "without UI auth" || fail "it prints the notice about listening without UI auth"
pass "it prints the notice about listening without UI auth"

docker stop --time 15 "$container_id" > /dev/null
exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$container_id")"
[ "$exit_code" = "0" ] || fail "SIGTERM stops it with exit code 0 (it exited $exit_code)"
pass "SIGTERM (docker stop) stops it with exit code 0"

# AC: DS-02.3
mount_directory="$(mktemp -d)"
mkdir -p "$mount_directory/config" "$mount_directory/templates"
printf 'max_emails = 1234\n' > "$mount_directory/config/sendmock.toml"
printf '# An empty seed file is a valid one.\n' > "$mount_directory/config/sendmock.seed.toml"
cat > "$mount_directory/templates/shop-orders.toml" <<'TEMPLATE'
id = "file.shop_orders"
name = "Shop orders from a file"
service = "Shop"
events = ["email.received"]

[request]
method = "POST"
content_type = "application/json"
body = '{"subject": "{{ data.subject }}"}'
TEMPLATE
chmod -R a+rX "$mount_directory"
mounted_container_id="$(docker run -d -p "127.0.0.1:$mounted_host_port:8025" \
  -v "$mount_directory/config:/config:ro" -v "$mount_directory/templates:/templates:ro" "$image")"
trap 'docker rm -f "$container_id" "$mounted_container_id" > /dev/null 2>&1 || true' EXIT
mounted_url="http://127.0.0.1:$mounted_host_port/api/v1"
for _ in $(seq 1 60); do
  curl -fsS "$mounted_url/health" > /dev/null 2>&1 && break
  sleep 1
done
curl -fsS "$mounted_url/settings" | grep -q '"max_emails":1234' || fail "the mounted /config/sendmock.toml is loaded: $(curl -sS "$mounted_url/settings")"
pass "the mounted /config/sendmock.toml is loaded"
curl -fsS "$mounted_url/seed/status" | grep -q '"source_path":"/config/sendmock.seed.toml"' || fail "the mounted /config/sendmock.seed.toml is applied: $(curl -sS "$mounted_url/seed/status")"
pass "the mounted /config/sendmock.seed.toml is applied"
curl -fsS "$mounted_url/webhooks/templates/file.shop_orders" | grep -q '"source":"file"' || fail "a template file mounted at /templates is loaded"
pass "a template file mounted at /templates is loaded"
docker rm -f "$mounted_container_id" > /dev/null

if [ "$variant" = "debug" ]; then
  docker run --rm --entrypoint /busybox/sh "$image" -c 'id -u' | grep -q '^10001$' || fail "the debug image has a shell and runs as UID 10001"
  pass "the debug image has a busybox shell and runs as UID 10001"
else
  if docker run --rm --entrypoint /bin/sh "$image" -c true > /dev/null 2>&1; then
    fail "the plain image has no shell"
  fi
  pass "the plain image has no shell"
fi

compressed_bytes="$(docker save "$image" | gzip -9 | wc -c | tr -d ' ')"
[ "$compressed_bytes" -lt "$maximum_compressed_bytes" ] || fail "the image is under 25 MB compressed ($compressed_bytes bytes)"
pass "the image is $((compressed_bytes / 1024 / 1024)) MB compressed, under 25 MB"
