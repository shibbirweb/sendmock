---
title: Troubleshooting
description: Common problems connecting an app to SendMock and how to fix them.
---

> **This page fills in as the server ships; the answers below apply from the first beta.**

## macOS says it could not verify sendmock

macOS blocks an unsigned program downloaded with a web browser ("Apple could not verify sendmock is free of malware"). The macOS builds are not signed with an Apple Developer ID yet; installs through Homebrew, the install script, npx or bunx are not affected. Remove the download mark once (use the path where you put `sendmock`):

```bash
xattr -d com.apple.quarantine /usr/local/bin/sendmock
```

Or run `sendmock` once, then open **System Settings > Privacy & Security** and click **Open Anyway**.

## Windows protected your PC

Windows SmartScreen shows this when you open an unsigned program downloaded with a web browser from File Explorer. The Windows builds are not signed with a code-signing certificate yet; running `sendmock` from a terminal, and installs through the PowerShell install script, Scoop, WinGet, Chocolatey, npx or bunx, are usually not affected.

- In the SmartScreen window, choose **More info**, then **Run anyway**. Windows remembers it.
- Or remove the download mark once in PowerShell (use the path where you put `sendmock.exe`):

  ```powershell
  Unblock-File .\sendmock\sendmock.exe
  ```

If your antivirus moves `sendmock.exe` to quarantine, check the download against the release's `SHA256SUMS` file, restore it, and [report it](https://github.com/shibbirweb/sendmock/issues) so we can ask the vendor to fix the false positive.

## My app cannot connect

- Check SendMock runs: `sendmock health`, or open `http://127.0.0.1:8025`.
- From a Docker container, `127.0.0.1` is the container itself. Use `host.docker.internal` (or the SendMock service name in Docker Compose).

## The email arrived but the client rejected it

Look in **Logs > SMTP sessions**: failed sessions are kept with the reason, such as a wrong password or a message over the size limit.

## The webhook never reached my app

Open the delivery in **Webhooks > Deliveries**: it shows the request, the response or connection error and every retry. **Replay** sends it again after you fix your app.

## Nothing shows up in Mail or SMS

Check **Logs**: a rejected SMTP session or API request is kept with the reason, even though no message was stored. See [Logs](./logs.md).

## An SMS or email was refused on purpose

Twilio's test numbers, the magic addresses, your own outcome rules and **Settings > Chaos** all refuse messages by design. **Test a number** and **Test an address** in Settings tell you which applies. See [Delivery and test numbers](./sms/delivery-and-test-numbers.md) and [Outcomes](./mail/outcomes.md).
