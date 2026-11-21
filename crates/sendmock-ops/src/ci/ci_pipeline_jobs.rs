//! The pipeline job `sendmock ci init` writes for each CI system (WH-15.6): install SendMock
//! with its checksum-checked script, start the app, run the CI file, publish the JUnit report.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// The script installs to `~/.local/bin`; the job calls it there rather than change `PATH`.
const INSTALL_COMMAND: &str = "curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh -s -- --no-modify-path";
const RUN_COMMAND: &str =
    "~/.local/bin/sendmock ci run sendmock.ci.yml --junit sendmock-report.xml";
const START_APP_NOTE: &str = "Start your app here, listening on the app_url of sendmock.ci.yml.";

/// The CI systems `sendmock ci init` writes a job for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CiSystem {
    GithubActions,
    GitlabCi,
    Circleci,
    BitbucketPipelines,
    AzurePipelines,
    Jenkins,
}

impl CiSystem {
    pub const ALL: [Self; 6] = [
        Self::GithubActions,
        Self::GitlabCi,
        Self::Circleci,
        Self::BitbucketPipelines,
        Self::AzurePipelines,
        Self::Jenkins,
    ];

    /// The file the job is written to, next to the system's own configuration.
    pub fn job_path(self) -> &'static str {
        match self {
            Self::GithubActions => ".github/workflows/sendmock.yml",
            Self::GitlabCi => ".gitlab/sendmock.gitlab-ci.yml",
            Self::Circleci => ".circleci/sendmock.yml",
            Self::BitbucketPipelines => "bitbucket-pipelines.sendmock.yml",
            Self::AzurePipelines => "azure-pipelines.sendmock.yml",
            Self::Jenkins => "Jenkinsfile.sendmock",
        }
    }

    /// What to do with the job file, for systems that read one configuration file.
    pub fn describe_job(self) -> &'static str {
        match self {
            Self::GithubActions => "The workflow; GitHub Actions runs it as it is.",
            Self::GitlabCi => "Add `include: .gitlab/sendmock.gitlab-ci.yml` to .gitlab-ci.yml.",
            Self::Circleci => "Copy the sendmock job and workflow into .circleci/config.yml.",
            Self::BitbucketPipelines => "Copy the step into bitbucket-pipelines.yml.",
            Self::AzurePipelines => {
                "Use it as a template: `- template: azure-pipelines.sendmock.yml`."
            }
            Self::Jenkins => "Copy the SendMock stage into your Jenkinsfile.",
        }
    }

    pub fn render_job(self) -> String {
        match self {
            Self::GithubActions => format!(
                "name: SendMock webhook tests\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n  sendmock:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Install SendMock\n        run: {INSTALL_COMMAND}\n      # {START_APP_NOTE}\n      - name: Run the webhook tests\n        run: {RUN_COMMAND}\n      - name: Publish the report\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: sendmock-report\n          path: sendmock-report.xml\n"
            ),
            Self::GitlabCi => format!(
                "sendmock:\n  image: ubuntu:24.04\n  before_script:\n    - apt-get update && apt-get install -y curl\n    - {INSTALL_COMMAND}\n  script:\n    # {START_APP_NOTE}\n    - {RUN_COMMAND}\n  artifacts:\n    when: always\n    reports:\n      junit: sendmock-report.xml\n"
            ),
            Self::Circleci => format!(
                "version: 2.1\n\njobs:\n  sendmock:\n    docker:\n      - image: cimg/base:current\n    steps:\n      - checkout\n      - run:\n          name: Install SendMock\n          command: {INSTALL_COMMAND}\n      # {START_APP_NOTE}\n      - run:\n          name: Run the webhook tests\n          command: mkdir -p reports && ~/.local/bin/sendmock ci run sendmock.ci.yml --junit reports/sendmock-report.xml\n      - store_test_results:\n          path: reports\n\nworkflows:\n  sendmock:\n    jobs:\n      - sendmock\n"
            ),
            Self::BitbucketPipelines => format!(
                "pipelines:\n  default:\n    - step:\n        name: SendMock webhook tests\n        image: atlassian/default-image:4\n        script:\n          - {INSTALL_COMMAND}\n          # {START_APP_NOTE}\n          - mkdir -p test-results && ~/.local/bin/sendmock ci run sendmock.ci.yml --junit test-results/sendmock-report.xml\n"
            ),
            Self::AzurePipelines => format!(
                "steps:\n  - script: {INSTALL_COMMAND}\n    displayName: Install SendMock\n  # {START_APP_NOTE}\n  - script: {RUN_COMMAND}\n    displayName: Run the webhook tests\n  - task: PublishTestResults@2\n    condition: always()\n    inputs:\n      testResultsFormat: JUnit\n      testResultsFiles: sendmock-report.xml\n"
            ),
            Self::Jenkins => format!(
                "pipeline {{\n  agent any\n  stages {{\n    stage('SendMock webhook tests') {{\n      steps {{\n        sh '{}'\n        // {START_APP_NOTE}\n        sh '{}'\n      }}\n    }}\n  }}\n  post {{\n    always {{\n      junit 'sendmock-report.xml'\n    }}\n  }}\n}}\n",
                INSTALL_COMMAND.replace('\'', "'\\''"),
                RUN_COMMAND.replace('\'', "'\\''")
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: WH-15.6
    #[test]
    fn every_system_gets_a_job_that_installs_runs_and_publishes_the_report() {
        for ci_system in CiSystem::ALL {
            let job = ci_system.render_job();
            assert!(
                job.contains("install.sh | sh -s -- --no-modify-path"),
                "{job}"
            );
            assert!(
                job.contains("sendmock ci run sendmock.ci.yml --junit"),
                "{job}"
            );
            assert!(job.contains("sendmock-report.xml"), "{job}");
            assert!(job.contains("Start your app here"), "{job}");
        }
    }

    // AC: WH-15.6
    #[test]
    fn the_yaml_jobs_parse_and_publish_junit_where_the_system_reads_it() {
        for ci_system in CiSystem::ALL
            .into_iter()
            .filter(|system| *system != CiSystem::Jenkins)
        {
            let parsed: serde_json::Value = serde_yaml_ng::from_str(&ci_system.render_job())
                .unwrap_or_else(|parse_error| panic!("{ci_system:?}: {parse_error}"));
            assert!(parsed.is_object(), "{ci_system:?}");
        }
        let gitlab_job: serde_json::Value =
            serde_yaml_ng::from_str(&CiSystem::GitlabCi.render_job()).unwrap_or_default();
        assert_eq!(
            gitlab_job["sendmock"]["artifacts"]["reports"]["junit"],
            "sendmock-report.xml"
        );
        assert!(
            CiSystem::Jenkins
                .render_job()
                .contains("junit 'sendmock-report.xml'")
        );
    }
}
