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

## Trust the CA with one command

`sendmock trust` adds the local CA to your system store and to the runtimes that ignore it, so your app reaches the HTTPS port with no setting of its own. It makes the CA if there is none yet, shows each place and what it will change, and asks first.

1. Add the CA where it is missing.

   ```bash
   sendmock trust
   ```

   It changes:

   - the system store: your login keychain on macOS, your Trusted Root store on Windows, the CA folder of your Linux distribution (through `sudo`, which may ask for your password);
   - each PHP it finds (Herd's, Homebrew's and the one on your `PATH`): a bundle of the CA file that PHP reads now plus the local CA, and a marked block in its `php.ini` setting `openssl.cafile` and `curl.cainfo`;
   - Java: the CA in the JDK's `cacerts` as `sendmock-local-ca` (run it with `sudo` when the JDK belongs to root).

   For Python (`certifi`) it writes a combined bundle and prints the `SSL_CERT_FILE` and `REQUESTS_CA_BUNDLE` lines to set; for Node.js it prints the `NODE_EXTRA_CA_CERTS` line.

2. Check what trusts the CA, changing nothing.

   ```bash
   sendmock trust --check
   ```

   The same report is at `GET /api/v1/tls/trust`, in the MCP tool `sendmock_tls_trust`, and under **Trusted by** in Settings > Connection.

3. Run it again whenever you like: places that already trust the CA are left as they are. To take everything out again:

   ```bash
   sendmock trust --undo
   ```

Add `--yes` to change without asking, for scripts. A server started with `--provider-tls-names` uses a CA made for those names; trust it after starting that server.

### Use your own local CA (mkcert)

If you already trust a local CA, such as one made with mkcert, give SendMock a certificate from it instead:

1. Make a certificate for the names your app calls.

   ```bash
   mkcert localhost 127.0.0.1 ::1
   ```

2. Start SendMock with it.

   ```bash
   sendmock --provider-tls-addr 127.0.0.1:8027 --provider-tls-cert localhost+2.pem --provider-tls-key localhost+2-key.pem
   ```

## Trust the CA by hand


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
