# SendMock

SendMock catches the email, SMS, payments and webhooks your app sends while you develop, and shows them in a web UI on your machine. Your app talks to SendMock over SMTP and the providers' own HTTP APIs, so nothing reaches a real inbox, phone or payment provider.

![The SendMock overview: latest emails and SMS, webhook deliveries and payments](docs/wiki/images/overview.jpg)

## Status

SendMock is being built in the open. The web UI is finished on mock data, and the Rust server behind it is under way. There is no release yet: the first beta comes with the email backend. You can already:

- try every screen in the [live demo](https://shibbirweb.github.io/sendmock/demo/), which runs on sample data in your browser;
- read the [documentation](https://shibbirweb.github.io/sendmock/docs/);
- follow progress in [docs/plan/PROGRESS.md](docs/plan/PROGRESS.md).

## Run it from source

You need [Rust](https://rustup.rs) and [Bun](https://bun.sh).

1. Build the web UI:

   ```bash
   cd web
   ```

   ```bash
   bun install --frozen-lockfile
   ```

   ```bash
   bun run build
   ```

2. Start SendMock from the repository root:

   ```bash
   cd ..
   ```

   ```bash
   cargo run -p sendmock
   ```

3. Open <http://127.0.0.1:8025>.

SendMock listens on `127.0.0.1` only, so nothing outside your machine can reach it. `sendmock --help` lists the flags, and `sendmock help --all` every command.

## Contributing

Read [CONTRIBUTING.md](.github/CONTRIBUTING.md) to set up and make a change, and [AGENTS.md](AGENTS.md) for the rules every change follows. Report security problems privately as described in [SECURITY.md](.github/SECURITY.md).

## Licence

SendMock is licensed under either of

- the Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE)), or
- the MIT licence ([LICENSE-MIT](LICENSE-MIT)),

at your option.
