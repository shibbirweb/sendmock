#!/usr/bin/env bash
# A fresh Laravel app with the Connection screen's settings sends through its Mail facade.
set -euo pipefail

composer create-project laravel/laravel laravel-app --prefer-dist --no-interaction --quiet
cd laravel-app
export MAIL_MAILER=smtp MAIL_HOST="${SMTP_HOST:-127.0.0.1}" MAIL_PORT="${SMTP_PORT:-1025}" MAIL_ENCRYPTION=null \
  MAIL_FROM_ADDRESS=app@laravel.test MAIL_FROM_NAME=App
php artisan tinker --execute="Illuminate\\Support\\Facades\\Mail::raw('Your code is 482913', fn (\$message) => \$message->to('user@example.test')->subject(getenv('SUBJECT') ?: 'From Laravel'));"
