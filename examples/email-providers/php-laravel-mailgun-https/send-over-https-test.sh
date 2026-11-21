#!/usr/bin/env bash
# A fresh Laravel app sends through its mailgun mailer (Symfony's Mailgun API transport, which
# only speaks HTTPS) to SendMock's HTTPS provider port, with SendMock's local CA trusted, and
# the email is stored as a Mailgun send.
# AC: PL-20.5
set -euo pipefail

sendmock_url="${SENDMOCK_URL:-http://127.0.0.1:8025}"
provider_tls_port="${SENDMOCK_PROVIDER_TLS_PORT:-8027}"
subject="Laravel over HTTPS $(date +%s)"

curl -fsS "$sendmock_url/api/v1/tls/ca" | jq -r .pem > "$PWD/sendmock-ca.pem"
composer create-project laravel/laravel laravel-app --prefer-dist --no-interaction --quiet
cd laravel-app
composer require symfony/mailgun-mailer symfony/http-client --no-interaction --quiet

export MAIL_FROM_ADDRESS=app@mg.shop.test MAIL_FROM_NAME=App
# New Laravel skeletons define neither the mailgun mailer nor services.mailgun, so set both.
mailgun_config="config(['mail.mailers.mailgun' => ['transport' => 'mailgun'], 'services.mailgun' => ['domain' => 'mg.shop.test', 'secret' => 'key-sendmock-example', 'endpoint' => 'localhost:$provider_tls_port', 'scheme' => 'https']]);"
send_mail="Illuminate\\Support\\Facades\\Mail::mailer('mailgun')->raw('Sent over HTTPS', fn (\$message) => \$message->to('user@example.test')->subject('$subject'));"
php -d "curl.cainfo=$PWD/../sendmock-ca.pem" -d "openssl.cafile=$PWD/../sendmock-ca.pem" artisan tinker \
  --execute="$mailgun_config $send_mail"

stored_source="$(curl -fsS "$sendmock_url/api/v1/emails" | jq -r --arg subject "$subject" '.items[] | select(.subject == $subject) | .source')"
if [ "$stored_source" != "mailgun" ]; then
  echo "Expected a Mailgun send with subject '$subject', found source '$stored_source'"
  exit 1
fi
echo "Stored as a Mailgun send: $subject"
