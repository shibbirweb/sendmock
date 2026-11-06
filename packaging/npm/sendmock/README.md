# sendmock

[SendMock](https://shibbirweb.github.io/sendmock/) catches the email, SMS, payments and webhooks your app sends, on your machine, so nothing reaches real people.

This package runs the SendMock binary for your computer (macOS, Linux and Windows, x64 and arm64), which your package manager installs as one of the `@sendmock/*` packages.

1. Install it in your project:

   ```bash
   npm install --save-dev sendmock
   ```

2. Start it:

   ```bash
   npx sendmock
   ```

3. Open http://127.0.0.1:8025 and point your app's SMTP settings at `127.0.0.1:1025`.

The beta is the `beta` tag: `npm install --save-dev sendmock@beta`. See the [install guide](https://shibbirweb.github.io/sendmock/docs/install/) for every other way to install it.
