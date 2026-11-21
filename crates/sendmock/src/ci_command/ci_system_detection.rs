use std::path::Path;

use sendmock_ops::CiSystem;

/// The repository's CI system, from the files it keeps, in this order; `None` when none is
/// found and `--provider` must say.
pub fn detect_ci_system(repository_root: &Path) -> Option<CiSystem> {
    let markers = [
        (".github/workflows", CiSystem::GithubActions),
        (".gitlab-ci.yml", CiSystem::GitlabCi),
        (".circleci", CiSystem::Circleci),
        ("bitbucket-pipelines.yml", CiSystem::BitbucketPipelines),
        ("azure-pipelines.yml", CiSystem::AzurePipelines),
        ("Jenkinsfile", CiSystem::Jenkins),
    ];
    markers
        .into_iter()
        .find(|(marker_path, _)| repository_root.join(marker_path).exists())
        .map(|(_, ci_system)| ci_system)
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: WH-15.6
    #[test]
    fn each_ci_system_is_found_from_its_own_file() -> std::io::Result<()> {
        for (marker_path, expected_system) in [
            (".github/workflows/test.yml", CiSystem::GithubActions),
            (".gitlab-ci.yml", CiSystem::GitlabCi),
            (".circleci/config.yml", CiSystem::Circleci),
            ("bitbucket-pipelines.yml", CiSystem::BitbucketPipelines),
            ("azure-pipelines.yml", CiSystem::AzurePipelines),
            ("Jenkinsfile", CiSystem::Jenkins),
        ] {
            let repository = tempfile::tempdir()?;
            let marker_file = repository.path().join(marker_path);
            if let Some(parent_directory) = marker_file.parent() {
                std::fs::create_dir_all(parent_directory)?;
            }
            std::fs::write(&marker_file, "")?;
            assert_eq!(
                detect_ci_system(repository.path()),
                Some(expected_system),
                "{marker_path}"
            );
        }
        assert_eq!(detect_ci_system(tempfile::tempdir()?.path()), None);
        Ok(())
    }
}
