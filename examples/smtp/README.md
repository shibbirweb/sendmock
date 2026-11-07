# SMTP client examples

Each folder sends one email to SendMock the way an app in that language or framework does, with the settings from Settings > Connection. CI runs every one against a release binary (`.github/workflows/smtp-clients.yml`) and checks the message through the API.

To run one by hand:

1. Start SendMock.

   ```sh
   sendmock --db memory
   ```

2. Send from an example, for example Python's smtplib.

   ```sh
   SUBJECT="From smtplib" python examples/smtp/python-smtplib/send.py
   ```

3. Check that SendMock stored it with its code.

   ```sh
   bun examples/smtp/check-received.ts "From smtplib"
   ```

The folders: `php-laravel`, `php-symfony`, `php-mail` (PHP `mail()` through `sendmock sendmail`), `node-nodemailer`, `python-smtplib`, `python-django`, `python-pytest` (reads the code through `/api/v1/otp`), `go-net-smtp`, `java-spring`, `rust-lettre`, `ruby-action-mailer` and `dotnet-mailkit`.
