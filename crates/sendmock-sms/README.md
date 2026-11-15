# sendmock-sms

The SMS domain of SendMock: messages, provider definitions and delivery simulation.

This crate is an internal part of [SendMock](https://crates.io/crates/sendmock), which catches the email, SMS, push notifications, payments and webhooks your app sends while you develop and test. It is published so that `cargo install sendmock` can build SendMock from crates.io. Its Rust API is not stable and can change in any release, so do not depend on it directly; use the `sendmock` binary, its REST API or its CLI instead.

## Install SendMock

```sh
cargo install sendmock --locked
```

Homebrew, npm, Docker, install scripts and the other ways to install are on the [install page](https://shibbirweb.github.io/sendmock/docs/install/).

## Links

- [Documentation](https://shibbirweb.github.io/sendmock/docs/)
- [Source code](https://github.com/shibbirweb/sendmock)
- [Changelog](https://github.com/shibbirweb/sendmock/blob/main/CHANGELOG.md)

## License

Licensed under either of the [MIT license](https://github.com/shibbirweb/sendmock/blob/main/LICENSE-MIT) or the [Apache License, Version 2.0](https://github.com/shibbirweb/sendmock/blob/main/LICENSE-APACHE), at your option.
