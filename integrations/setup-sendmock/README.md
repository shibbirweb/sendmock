# Set up SendMock

A GitHub Action that installs [SendMock](https://github.com/shibbirweb/sendmock) at a chosen version (checked against the release's `SHA256SUMS`), starts it with a setup file or URL, waits until it is ready, and can run a CI file with `sendmock ci run`.

This folder is the action's source. It is published from its own repository, `shibbirweb/setup-sendmock`, since an action listed on the Marketplace lives in a repository of its own.

## Use it

1. Add the step to your workflow:

```yaml
- uses: shibbirweb/setup-sendmock@v1
  with:
    version: latest
    setup: https://raw.githubusercontent.com/acme/shop/main/sendmock.setup.yml
```

2. Start your app, pointed at `http://127.0.0.1:8025` and SMTP `127.0.0.1:1025`.

3. Run your webhook tests, or let the action run them:

```yaml
- uses: shibbirweb/setup-sendmock@v1
  with:
    setup: sendmock.setup.yml
    ci-file: sendmock.ci.yml
    junit: sendmock-report.xml
```

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `version` | `latest` | a release such as `1.4.0`, `latest` or `beta` |
| `setup` | | a setup file or `https://` URL, applied before SendMock reports ready |
| `http-addr` | `127.0.0.1:8025` | the web UI, REST API and MCP address |
| `smtp-addr` | `127.0.0.1:1025` | the SMTP address |
| `args` | | more `sendmock` flags |
| `ci-file` | | a CI file to run once SendMock is ready |
| `junit` | `sendmock-report.xml` | where the JUnit report goes |

## Outputs

| Output | What it holds |
| --- | --- |
| `http-url` | SendMock's HTTP address |
| `smtp-address` | SendMock's SMTP address |
