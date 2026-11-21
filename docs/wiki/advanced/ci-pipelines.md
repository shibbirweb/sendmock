---
title: Webhook tests in CI
description: Run your webhook tests in any CI pipeline with one CI file, JUnit reports and a ready-made job for GitHub Actions, GitLab CI, CircleCI, Bitbucket Pipelines, Azure Pipelines, Jenkins and Buildkite.
---

A CI file names the setup to load, where your app listens and the scenarios to run. `sendmock ci run` runs it against its own SendMock on free ports, writes a JUnit report every CI system shows, and exits `0` when every scenario passes, `5` when one fails and `2` when a file is invalid.

## What it solves

- Your app's webhook handler is only tested by hand: a signature check, a retry or a duplicate never runs in CI.
- The webhooks your app sends are never checked: their body, their signature, and what your app does when the receiver fails.
- Setting up a mock in each pipeline takes many steps; here it is one file and one command.

## The CI file

The CI file is JSON or YAML, with a version header like a [setup file](../configuration.md#setup-files-toml-json-or-yaml-with-a-version). Its JSON Schema is published at [`/schema/ci/v1.json`](/schema/ci/v1.json).

```yaml
sendmock:
  format: sendmock.ci
  format_version: 1
setup: sendmock.setup.yml
app_url: http://localhost:8000
scenarios:
  - name: the shop accepts a signed webhook
    steps:
      - run: webhook.endpoint.test
        with: { endpoint_id: Shop app }
      - run: webhook.delivery.wait
        with: { endpoint: Shop app, status: succeeded, timeout: 10s }
        save: delivery
      - run: assert
        with: { that: "{{ delivery.response.status_code }} == 200" }
  - file: scenarios/refund.toml
report:
  junit: sendmock-report.xml
```

| Key | What it holds |
| --- | --- |
| `setup` | a setup file's path (relative to the CI file) or `https://` URL, applied first |
| `app_url` | your app's base URL; steps read it as `{{ app_url }}` |
| `scenarios` | each with `name` and `steps` inline, or `file:` (a path), `url:` or `text:` holding a [scenario file](./scenarios.md) in TOML, JSON or YAML |
| `report` | `junit` and `json`: where the reports go, unless `--junit` says otherwise |

A scenario runs its steps up to its first failure; a failed scenario does not stop the next.

## Steps for webhook tests

When your app receives webhooks:

- `webhook.endpoint.test` sends an endpoint's test event, signed with the endpoint's secret, and `webhook.delivery.wait` waits for its outcome; `assert` checks your app's answer.
- `webhook.send` sends a provider's real webhook (Stripe, PayPal, Twilio, Postmark, SendGrid, Mailgun or Standard Webhooks) for an email or SMS, and `webhook.delivery.replay` sends it again, so a scenario checks that a replay is handled once.
- `settings.update` with a failure rate, or an endpoint's retry policy, makes a delivery fail and retry.

When your app sends webhooks, point it at an HTTP Catcher bin:

- `http.request.wait` waits for the request your app sent, by bin, method and path.
- `webhook.signature.verify` checks its signature: `standard_webhooks`, `stripe`, or `hmac` with the header, `hex` or `base64`, and a prefix such as `sha256=`.
- `assert` with `json`, `path` and `equals` (or `exists`) checks a value in its body with a JSONPath such as `$.data.status`.
- The bin's [response rules](./catcher-responses.md) answer errors, timeouts or delays, to test your app's own retries.

## Run it

1. Run the CI file:

```bash
sendmock ci run sendmock.ci.yml --junit sendmock-report.xml
```

2. Read the lines it prints: `passed` or `failed` for each scenario, with the failing step's reason.

`--json` prints the whole report, `--server http://127.0.0.1:8025` runs against a SendMock that is already running, and with `GITHUB_STEP_SUMMARY` set the run adds a summary to the GitHub Actions run page. The Scenarios screen runs a CI file too, shows the report and downloads the JUnit file.

## Set it up with `sendmock ci init`

1. Start SendMock with the setup your tests need.

2. In your repository, write the files:

```bash
sendmock ci init
```

It finds your CI system from `.github/workflows`, `.gitlab-ci.yml`, `.circleci`, `bitbucket-pipelines.yml`, `azure-pipelines.yml` or a `Jenkinsfile`, and writes `sendmock.setup.yml`, a starter `sendmock.ci.yml` with one scenario per webhook endpoint, and the job. `--provider` chooses the system, `--setup-url` makes the CI file download the setup, and `--yes` overwrites files that exist. Settings > Setup > **Use in CI** shows the same files.

3. Add the step that starts your app to the job, then commit.

With an AI agent, the `setup-ci` prompt walks through the same steps.

## Pipeline jobs

Each job installs SendMock, starts your app, runs the CI file and publishes the JUnit report. Start your app where the comment says.

### GitHub Actions

1. Add `.github/workflows/sendmock.yml`:

```yaml
name: SendMock webhook tests
on: [pull_request]
jobs:
  sendmock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install SendMock
        run: curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path
      # Start your app here.
      - name: Run the webhook tests
        run: ~/.local/bin/sendmock ci run sendmock.ci.yml --junit sendmock-report.xml
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: sendmock-report
          path: sendmock-report.xml
```

2. Or run SendMock as a service container, loaded from a setup URL, and point your app's tests at `http://localhost:8025`:

```yaml
services:
  sendmock:
    image: ghcr.io/shibbirweb/sendmock:1
    ports: ["8025:8025", "1025:1025"]
    env:
      SENDMOCK_DB: memory
      SENDMOCK_SETUP: https://raw.githubusercontent.com/acme/shop/main/sendmock.setup.yml
```

### GitLab CI

1. Add `.gitlab/sendmock.gitlab-ci.yml`:

```yaml
sendmock:
  image: ubuntu:24.04
  before_script:
    - apt-get update && apt-get install -y curl
    - curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path
  script:
    # Start your app here.
    - ~/.local/bin/sendmock ci run sendmock.ci.yml --junit sendmock-report.xml
  artifacts:
    when: always
    reports:
      junit: sendmock-report.xml
```

2. Include it from `.gitlab-ci.yml`:

```yaml
include: .gitlab/sendmock.gitlab-ci.yml
```

### CircleCI

1. Add the job and workflow to `.circleci/config.yml`:

```yaml
version: 2.1
jobs:
  sendmock:
    docker:
      - image: cimg/base:current
    steps:
      - checkout
      - run: curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path
      # Start your app here.
      - run: mkdir -p reports && ~/.local/bin/sendmock ci run sendmock.ci.yml --junit reports/sendmock-report.xml
      - store_test_results:
          path: reports
workflows:
  sendmock:
    jobs:
      - sendmock
```

### Bitbucket Pipelines

1. Add the step to `bitbucket-pipelines.yml`. Bitbucket reads JUnit files under `test-results`:

```yaml
pipelines:
  default:
    - step:
        name: SendMock webhook tests
        image: atlassian/default-image:4
        script:
          - curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path
          # Start your app here.
          - mkdir -p test-results && ~/.local/bin/sendmock ci run sendmock.ci.yml --junit test-results/sendmock-report.xml
```

### Azure Pipelines

1. Add `azure-pipelines.sendmock.yml`:

```yaml
steps:
  - script: curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path
    displayName: Install SendMock
  # Start your app here.
  - script: ~/.local/bin/sendmock ci run sendmock.ci.yml --junit sendmock-report.xml
    displayName: Run the webhook tests
  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: sendmock-report.xml
```

2. Use it from `azure-pipelines.yml`:

```yaml
steps:
  - template: azure-pipelines.sendmock.yml
```

### Jenkins

1. Add the stage to your `Jenkinsfile`:

```groovy
pipeline {
  agent any
  stages {
    stage('SendMock webhook tests') {
      steps {
        sh 'curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path'
        // Start your app here.
        sh '~/.local/bin/sendmock ci run sendmock.ci.yml --junit sendmock-report.xml'
      }
    }
  }
  post {
    always {
      junit 'sendmock-report.xml'
    }
  }
}
```

### Buildkite

1. Add the step to `.buildkite/pipeline.yml`:

```yaml
steps:
  - label: SendMock webhook tests
    command:
      - curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path
      # Start your app here.
      - ~/.local/bin/sendmock ci run sendmock.ci.yml --junit sendmock-report.xml
    artifact_paths: sendmock-report.xml
```

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| check a CI file | [`sendmock ci validate <file>`](/cli/automation/#ci-validate) | [`POST /api/v1/ci/validate`](/api/automation/#postCiValidate) | [`sendmock_ci_validate`](/mcp/automation/#sendmock_ci_validate) |
| run a CI file | [`sendmock ci run <file>`](/cli/automation/#ci-run) | [`POST /api/v1/ci/run`](/api/automation/#postCiRun) | [`sendmock_ci_run`](/mcp/automation/#sendmock_ci_run) |
| write the files for a pipeline | [`sendmock ci init`](/cli/automation/#ci-init) | [`POST /api/v1/ci/init`](/api/automation/#postCiInit) | [`sendmock_ci_init`](/mcp/automation/#sendmock_ci_init) |
| check a webhook's signature | [`sendmock webhook signature verify`](/cli/webhook-deliveries/#webhook-signature-verify) | [`POST /api/v1/webhooks/signatures/verify`](/api/webhook-deliveries/#postWebhooksSignaturesVerify) | [`sendmock_webhook_signature_verify`](/mcp/webhook-deliveries/#sendmock_webhook_signature_verify) |

## Related

- [Scenarios](./scenarios.md)
- [Catcher responses](./catcher-responses.md)
- [Configuration and seed file](../configuration.md)
