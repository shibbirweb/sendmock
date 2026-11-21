#!/usr/bin/env bash
# Runs the CI example two ways: `sendmock ci run` with its own SendMock, and a SendMock started
# with SENDMOCK_SETUP pointing at a URL. A broken shop app must fail the run with exit code 5.
# AC: WH-15.9
set -euo pipefail

sendmock_binary="${SENDMOCK_BINARY:-sendmock}"
example_directory="$(cd "$(dirname "$0")" && pwd)"
export SHOP_WEBHOOK_SECRET="whsec_c2hvcC1pbmNvbWluZy1rZXk="
export SHOP_OUTGOING_SECRET="whsec_c2hvcC1vdXRnb2luZy1rZXk="
export SHOP_WEBHOOK_TARGET="http://127.0.0.1:8025/catch/shop-outgoing"

start_shop_app() {
  node "$example_directory/shop-app.js" &
  shop_app_pid=$!
  for _ in $(seq 1 50); do
    if curl -s -o /dev/null http://127.0.0.1:8000/; then
      return
    fi
    sleep 0.2
  done
}

stop_shop_app() {
  kill "$shop_app_pid" 2>/dev/null || true
  wait "$shop_app_pid" 2>/dev/null || true
}

echo "1. sendmock ci run with its own SendMock"
start_shop_app
"$sendmock_binary" ci run "$example_directory/sendmock.ci.yml" --junit sendmock-report.xml
grep -q 'failures="0"' sendmock-report.xml
grep -q 'name="the shop sends a signed order.paid webhook"' sendmock-report.xml
stop_shop_app

echo "2. A broken shop app fails the run with exit code 5"
SHOP_BROKEN=1 start_shop_app
set +e
"$sendmock_binary" ci run "$example_directory/sendmock.ci.yml" --junit broken-report.xml
broken_exit_code=$?
set -e
stop_shop_app
if [ "$broken_exit_code" -ne 5 ]; then
  echo "Expected exit code 5 for the broken app, got $broken_exit_code"
  exit 1
fi
grep -q '<failure message=' broken-report.xml

echo "3. SENDMOCK_SETUP from a URL, then sendmock ci run --server"
python3 -m http.server 8099 --bind 127.0.0.1 --directory "$example_directory" > /dev/null 2>&1 &
static_server_pid=$!
SENDMOCK_SETUP="http://127.0.0.1:8099/sendmock.setup.yml" SENDMOCK_DB=memory \
  "$sendmock_binary" --http-addr 127.0.0.1:8025 --smtp-addr 127.0.0.1:1025 > sendmock-server.log 2>&1 &
sendmock_pid=$!
for _ in $(seq 1 50); do
  curl -fsS -o /dev/null http://127.0.0.1:8025/api/v1/health && break
  sleep 0.2
done
curl -fsS http://127.0.0.1:8025/api/v1/webhooks/endpoints | grep -q '"Shop app"'
start_shop_app
"$sendmock_binary" ci run "$example_directory/sendmock.ci.yml" --server http://127.0.0.1:8025 --junit server-report.xml
grep -q 'failures="0"' server-report.xml
stop_shop_app
kill "$sendmock_pid" "$static_server_pid" 2>/dev/null || true
echo "The CI example passed both ways and failed for the broken app"
