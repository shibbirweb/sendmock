#!/usr/bin/env bash
# Checks a built SendMock image before it is pushed (DS-02.1, DS-02.2, DS-02.5): non-root,
# data in /data, healthy once listening, the notice about listening without UI auth, a clean
# stop on SIGTERM, and under 25 MB compressed.
#
#     scripts/docker-image-test.sh <image>
set -euo pipefail

image="$1"
host_port=18025
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

compressed_bytes="$(docker save "$image" | gzip -9 | wc -c | tr -d ' ')"
[ "$compressed_bytes" -lt "$maximum_compressed_bytes" ] || fail "the image is under 25 MB compressed ($compressed_bytes bytes)"
pass "the image is $((compressed_bytes / 1024 / 1024)) MB compressed, under 25 MB"
