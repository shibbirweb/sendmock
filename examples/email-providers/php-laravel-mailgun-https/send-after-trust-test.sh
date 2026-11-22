#!/usr/bin/env bash
# After `sendmock trust`, the Laravel app from send-over-https-test.sh sends through its mailgun
# mailer to the HTTPS provider port with no CA setting of its own: the system store and PHP
# trust SendMock's local CA. It runs `sendmock trust` as root with the server user's home, so
# both use the same CA, and checks `--check` before and after.
# AC: PL-25.1 PL-25.2 PL-25.3 PL-25.4
set -euo pipefail

sendmock_url="${SENDMOCK_URL:-http://127.0.0.1:8025}"
provider_tls_port="${SENDMOCK_PROVIDER_TLS_PORT:-8027}"
server_home="${SENDMOCK_SERVER_HOME:-/var/lib/sendmock-offline}"
subject="Laravel after sendmock trust $(date +%s)"

run_trust() {
  sudo env HOME="$server_home" /usr/local/bin/sendmock trust "$@"
}

run_trust --yes
run_trust --yes | grep -q "Nothing to change"
run_trust --check --json | jq -e '[.places[] | select(.place == "Linux CA folder")][0].state == "trusted"' > /dev/null

cd laravel-app
mailgun_config="config(['mail.mailers.mailgun' => ['transport' => 'mailgun'], 'services.mailgun' => ['domain' => 'mg.shop.test', 'secret' => 'key-sendmock-example', 'endpoint' => 'localhost:$provider_tls_port', 'scheme' => 'https']]);"
send_mail="Illuminate\\Support\\Facades\\Mail::mailer('mailgun')->raw('Sent after trust', fn (\$message) => \$message->to('user@example.test')->subject('$subject'));"
php artisan tinker --execute="$mailgun_config $send_mail"

stored_source="$(curl -fsS "$sendmock_url/api/v1/emails" | jq -r --arg subject "$subject" '.items[] | select(.subject == $subject) | .source')"
if [ "$stored_source" != "mailgun" ]; then
  echo "Expected a Mailgun send with subject '$subject', found source '$stored_source'"
  exit 1
fi
echo "Stored as a Mailgun send after sendmock trust: $subject"

cd ..
run_trust --undo --yes
run_trust --check --json | jq -e '[.places[] | select(.place == "Linux CA folder")][0].state == "missing"' > /dev/null
echo "sendmock trust --undo removed the CA again"
