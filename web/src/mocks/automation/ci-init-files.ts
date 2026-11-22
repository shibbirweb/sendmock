import type { CiInitFile, CiInitRequest, CiSystem } from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  buildSetupDocument,
  writeSetupText,
} from "@/mocks/setup/mock-setup-document";

const installCommand =
  "curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path";
const runCommand =
  "~/.local/bin/sendmock ci run sendmock.ci.yml --junit sendmock-report.xml";
const startAppNote =
  "Start your app here, listening on the app_url of sendmock.ci.yml.";

/** Each CI system's job file, as the server writes it (WH-15.6). */
const pipelineJobs: Record<
  CiSystem,
  { path: string; purpose: string; content: string }
> = {
  github_actions: {
    path: ".github/workflows/sendmock.yml",
    purpose: "The workflow; GitHub Actions runs it as it is.",
    content: `name: SendMock webhook tests\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n  sendmock:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Install SendMock\n        run: ${installCommand}\n      # ${startAppNote}\n      - name: Run the webhook tests\n        run: ${runCommand}\n      - name: Publish the report\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: sendmock-report\n          path: sendmock-report.xml\n`,
  },
  gitlab_ci: {
    path: ".gitlab/sendmock.gitlab-ci.yml",
    purpose: "Add `include: .gitlab/sendmock.gitlab-ci.yml` to .gitlab-ci.yml.",
    content: `sendmock:\n  image: ubuntu:24.04\n  before_script:\n    - apt-get update && apt-get install -y curl\n    - ${installCommand}\n  script:\n    # ${startAppNote}\n    - ${runCommand}\n  artifacts:\n    when: always\n    reports:\n      junit: sendmock-report.xml\n`,
  },
  circleci: {
    path: ".circleci/sendmock.yml",
    purpose: "Copy the sendmock job and workflow into .circleci/config.yml.",
    content: `version: 2.1\n\njobs:\n  sendmock:\n    docker:\n      - image: cimg/base:current\n    steps:\n      - checkout\n      - run:\n          name: Install SendMock\n          command: ${installCommand}\n      # ${startAppNote}\n      - run:\n          name: Run the webhook tests\n          command: mkdir -p reports && ~/.local/bin/sendmock ci run sendmock.ci.yml --junit reports/sendmock-report.xml\n      - store_test_results:\n          path: reports\n\nworkflows:\n  sendmock:\n    jobs:\n      - sendmock\n`,
  },
  bitbucket_pipelines: {
    path: "bitbucket-pipelines.sendmock.yml",
    purpose: "Copy the step into bitbucket-pipelines.yml.",
    content: `pipelines:\n  default:\n    - step:\n        name: SendMock webhook tests\n        image: atlassian/default-image:4\n        script:\n          - ${installCommand}\n          # ${startAppNote}\n          - mkdir -p test-results && ~/.local/bin/sendmock ci run sendmock.ci.yml --junit test-results/sendmock-report.xml\n`,
  },
  azure_pipelines: {
    path: "azure-pipelines.sendmock.yml",
    purpose:
      "Use it as a template: `- template: azure-pipelines.sendmock.yml`.",
    content: `steps:\n  - script: ${installCommand}\n    displayName: Install SendMock\n  # ${startAppNote}\n  - script: ${runCommand}\n    displayName: Run the webhook tests\n  - task: PublishTestResults@2\n    condition: always()\n    inputs:\n      testResultsFormat: JUnit\n      testResultsFiles: sendmock-report.xml\n`,
  },
  jenkins: {
    path: "Jenkinsfile.sendmock",
    purpose: "Copy the SendMock stage into your Jenkinsfile.",
    content: `pipeline {\n  agent any\n  stages {\n    stage('SendMock webhook tests') {\n      steps {\n        sh '${installCommand}'\n        // ${startAppNote}\n        sh '${runCommand}'\n      }\n    }\n  }\n  post {\n    always {\n      junit 'sendmock-report.xml'\n    }\n  }\n}\n`,
  },
};

function buildCiFile(
  mockDatabase: MockDatabase,
  setupLocation: string,
  appUrl: string,
): string {
  const scenarios = mockDatabase.webhookEndpoints.map((endpoint) => {
    const endpointName = JSON.stringify(endpoint.name);
    return `  - name: ${JSON.stringify(`${endpoint.name} accepts a signed webhook`)}\n    steps:\n      - run: webhook.endpoint.test\n        with: { endpoint_id: ${endpointName} }\n      - run: webhook.delivery.wait\n        with: { endpoint: ${endpointName}, status: succeeded, timeout: 10s }\n`;
  });

  return `# Run with: sendmock ci run sendmock.ci.yml --junit sendmock-report.xml\nsendmock:\n  format: sendmock.ci\n  format_version: 1\nsetup: ${setupLocation}\napp_url: ${appUrl}\nscenarios:\n${scenarios.join("")}`;
}

/** The setup, a starter CI file and the job, as `POST /api/v1/ci/init` answers them. */
export function buildCiInitFiles(
  mockDatabase: MockDatabase,
  initRequest: CiInitRequest,
): CiInitFile[] {
  const pipelineJob = pipelineJobs[initRequest.provider];
  return [
    {
      path: "sendmock.setup.yml",
      content: writeSetupText(buildSetupDocument(mockDatabase), "yaml"),
      purpose:
        "This instance's setup, secrets as ${ENV_VAR} references; commit it, or host it and give its URL.",
    },
    {
      path: "sendmock.ci.yml",
      content: buildCiFile(
        mockDatabase,
        initRequest.setup_url ?? "sendmock.setup.yml",
        initRequest.app_url ?? "http://localhost:8000",
      ),
      purpose: "The CI file: one scenario per webhook endpoint to start from.",
    },
    pipelineJob,
  ];
}
