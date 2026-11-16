# sendmock-tray

A menu bar and system tray app for [SendMock](https://crates.io/crates/sendmock). It puts an envelope in the macOS menu bar or the Windows and Linux system tray whose menu shows SendMock's status and the unread email and SMS counts, opens the web UI, and starts and stops the server.

It uses the SendMock already running at `http://127.0.0.1:8025`, or starts `sendmock serve` itself. Quitting stops only a server the tray started.

## Install

The tray app needs SendMock installed (any way on the [install page](https://shibbirweb.github.io/sendmock/docs/install/)) and Rust to build.

1. On Linux only, install the libraries the tray uses (Debian and Ubuntu shown):

   ```sh
   sudo apt-get install -y libgtk-3-dev libxdo-dev libayatana-appindicator3-dev
   ```

2. Install the tray app. The app is behind the `gui` feature, so a plain `cargo install sendmock-tray` builds nothing to run:

   ```sh
   cargo install sendmock-tray --features gui --locked
   ```

3. Start it:

   ```sh
   sendmock-tray
   ```

4. Click the envelope in the menu bar or tray. On macOS the unread total shows next to it.

## Options

- `--url <url>` watches a SendMock at another address, for example `sendmock-tray --url http://127.0.0.1:9000`.
- `--sendmock <path>` starts that `sendmock` binary instead of the one on your `PATH`.

## Links

- [Documentation](https://shibbirweb.github.io/sendmock/docs/)
- [Source code](https://github.com/shibbirweb/sendmock)
- [Changelog](https://github.com/shibbirweb/sendmock/blob/main/CHANGELOG.md)

## License

Licensed under either of the [MIT license](https://github.com/shibbirweb/sendmock/blob/main/LICENSE-MIT) or the [Apache License, Version 2.0](https://github.com/shibbirweb/sendmock/blob/main/LICENSE-APACHE), at your option.
