---
title: HTTPS for provider SDKs
description: Serve the provider APIs over HTTPS for SDKs that only speak HTTPS, and trust SendMock's local CA on your machine, in Docker and in your runtime.
---

Some SDKs always call `https://`, with no way to choose plain HTTP. Laravel's `mailgun` mailer is one: Symfony's Mailgun transports build `'https://'.$endpoint`. For them, SendMock serves the same provider APIs over HTTPS on a second port.

## Turn it on

1. Start SendMock with the HTTPS provider port, next to the plain one.

   ```bash
   sendmock --provider-addr 127.0.0.1:8026 --provider-tls-addr 127.0.0.1:8027
   ```

2. SendMock makes a local CA once, in its data folder (the key readable only by you), and a certificate from it for `localhost`, `127.0.0.1` and `::1`. Add other names, such as a Docker service name, with `--provider-tls-names`.

   ```bash
   sendmock --provider-tls-addr 0.0.0.0:8027 --provider-tls-names sendmock,mail.test
   ```

   The CA can only vouch for these names, so trusting it cannot vouch for any other site. To use your own certificate (for example one made with mkcert) instead, pass `--provider-tls-cert` and `--provider-tls-key`.

3. Print the CA's path and certificate.

   ```bash
   sendmock tls ca
   ```

   The same is at `GET /api/v1/tls/ca`, and Settings > Connection shows the HTTPS address with **Download the CA**. `/api/v1/info` and `--ready-json` name the HTTPS address as `provider_tls_address` and `provider_tls_addr`.

## Trust the CA on your machine

On macOS:

1. Add it to the system keychain.

   ```bash
   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$(sendmock tls ca --json | jq -r .path)"
   ```

On Windows (PowerShell as administrator):

1. Save the certificate.

   ```powershell
   sendmock tls ca --json | ConvertFrom-Json | ForEach-Object { $_.pem } | Set-Content sendmock-ca.pem
   ```

2. Add it to the trusted roots.

   ```powershell
   Import-Certificate -FilePath sendmock-ca.pem -CertStoreLocation Cert:\LocalMachine\Root
   ```

On Debian and Ubuntu:

1. Copy it into the local certificates folder.

   ```bash
   sudo cp "$(sendmock tls ca --json | jq -r .path)" /usr/local/share/ca-certificates/sendmock-ca.crt
   ```

2. Update the trust store.

   ```bash
   sudo update-ca-certificates
   ```

On Fedora and RHEL:

1. Copy it into the anchors folder.

   ```bash
   sudo cp "$(sendmock tls ca --json | jq -r .path)" /etc/pki/ca-trust/source/anchors/sendmock-ca.pem
   ```

2. Update the trust store.

   ```bash
   sudo update-ca-trust
   ```

## Trust it in Docker

1. Fetch the CA from the running container into your app's build context.

   ```bash
   curl -s http://localhost:8025/api/v1/tls/ca | jq -r .pem > sendmock-ca.crt
   ```

2. In your app's Dockerfile (Debian-based images), add it and update the store.

   ```dockerfile
   COPY sendmock-ca.crt /usr/local/share/ca-certificates/sendmock-ca.crt
   RUN update-ca-certificates
   ```

Start SendMock with `--provider-tls-names sendmock` (its service name) so the certificate matches the name your app connects to.

## Trust it in your runtime

Some runtimes keep their own trust store. Point each at the CA file:

- **PHP:** set `openssl.cafile` (and `curl.cainfo`) in `php.ini`.

  ```ini
  openssl.cafile=/path/to/provider-ca-certificate.pem
  curl.cainfo=/path/to/provider-ca-certificate.pem
  ```

- **Node.js:** set `NODE_EXTRA_CA_CERTS` before starting the app.

  ```bash
  NODE_EXTRA_CA_CERTS=/path/to/provider-ca-certificate.pem node app.js
  ```

- **Python:** `requests` reads `REQUESTS_CA_BUNDLE`, the standard library `SSL_CERT_FILE`.

  ```bash
  REQUESTS_CA_BUNDLE=/path/to/provider-ca-certificate.pem SSL_CERT_FILE=/path/to/provider-ca-certificate.pem python app.py
  ```

- **Java:** import it into the JDK's trust store.

  ```bash
  keytool -importcert -alias sendmock -file /path/to/provider-ca-certificate.pem -cacerts -storepass changeit -noprompt
  ```

- **.NET:** on Linux, .NET reads the system store, so the Linux steps above are enough; on Windows and macOS, the system steps are.

## Point the SDK at it

Use `https://localhost:8027` (or your `--provider-tls-addr`) wherever the SDK takes a base URL or endpoint. For Laravel's `mailgun` mailer, set `MAILGUN_ENDPOINT=localhost:8027` and keep `MAILGUN_DOMAIN` and `MAILGUN_SECRET` as they are.
