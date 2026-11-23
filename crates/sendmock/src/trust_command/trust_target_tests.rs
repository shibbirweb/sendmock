use std::path::PathBuf;
use std::sync::Arc;

use super::fake_command_runner::FakeCommandRunner;
use super::java_target::JavaTarget;
use super::php_target::PhpTarget;
use super::system_store_target::{LinuxCaFolderTarget, MacKeychainTarget};
use super::trust_target::{LocalCa, TrustState, TrustTarget};

const CA_PEM: &str = "-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n";

fn build_local_ca(folder: &std::path::Path) -> LocalCa {
    let certificate_path = folder.join("provider-ca-certificate.pem");
    let _ = std::fs::write(&certificate_path, CA_PEM);
    LocalCa {
        certificate_path,
        certificate_pem: CA_PEM.to_owned(),
        bundle_folder: folder.join("trust"),
    }
}

// AC: PL-25.1
#[test]
fn the_macos_keychain_is_checked_with_verify_cert_and_added_as_a_trusted_root() {
    let runner = Arc::new(FakeCommandRunner::succeeding(&["security"]));
    let folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let local_ca = build_local_ca(folder.path());
    let keychain = MacKeychainTarget {
        runner: runner.clone(),
    };

    let check = keychain.check(&local_ca);
    let added = keychain.add(&local_ca);

    assert_eq!(check.state, TrustState::Trusted);
    assert!(added.is_ok(), "{added:?}");
    let calls = runner.recorded_calls();
    assert!(calls[0].starts_with("security verify-cert -c"), "{calls:?}");
    assert!(
        calls[1].starts_with("security add-trusted-cert -r trustRoot -k"),
        "{calls:?}"
    );
}

// AC: PL-25.1 PL-25.3
#[test]
fn the_linux_ca_folder_is_found_checked_by_its_file_and_changed_through_sudo() {
    let runner = Arc::new(FakeCommandRunner::succeeding(&["sudo"]));
    let root_folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let ca_folder = root_folder.path().join("usr/local/share/ca-certificates");
    std::fs::create_dir_all(&ca_folder).unwrap_or_else(|error| panic!("{error}"));
    let local_ca = build_local_ca(root_folder.path());
    let linux_folder = LinuxCaFolderTarget::find(runner.clone(), root_folder.path())
        .unwrap_or_else(|| panic!("the Debian layout is found"));

    let missing = linux_folder.check(&local_ca);
    let added = linux_folder.add(&local_ca);
    std::fs::write(ca_folder.join("sendmock-local-ca.crt"), CA_PEM)
        .unwrap_or_else(|error| panic!("{error}"));
    let trusted = linux_folder.check(&local_ca);

    assert_eq!(missing.state, TrustState::Missing);
    assert!(added.is_ok(), "{added:?}");
    assert_eq!(trusted.state, TrustState::Trusted);
    let calls = runner.recorded_calls();
    assert!(calls[0].starts_with("sudo install -m 644"), "{calls:?}");
    assert_eq!(calls[1], "sudo update-ca-certificates");
}

// AC: PL-25.2 PL-25.3
#[test]
fn java_cacerts_is_checked_added_and_removed_under_one_alias() {
    let runner = Arc::new(FakeCommandRunner::succeeding(&["/jdk/bin/keytool"]));
    let folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let local_ca = build_local_ca(folder.path());
    let java = JavaTarget {
        runner: runner.clone(),
        keytool: PathBuf::from("/jdk/bin/keytool"),
    };

    let check = java.check(&local_ca);
    let added = java.add(&local_ca);
    let removed = java.remove(&local_ca);

    assert_eq!(check.state, TrustState::Trusted);
    assert!(added.is_ok() && removed.is_ok());
    let calls = runner.recorded_calls();
    assert!(
        calls[1].contains("-importcert -alias sendmock-local-ca"),
        "{calls:?}"
    );
    assert!(
        calls[2].contains("-list -alias sendmock-local-ca"),
        "{calls:?}"
    );
    assert!(
        calls[3].contains("-delete -alias sendmock-local-ca"),
        "{calls:?}"
    );
}

// AC: PL-25.3
#[test]
fn an_alias_the_system_bundle_rebuild_already_removed_counts_as_removed() {
    let runner = Arc::new(FakeCommandRunner::succeeding(&[]));
    let folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let local_ca = build_local_ca(folder.path());
    let java = JavaTarget {
        runner: runner.clone(),
        keytool: PathBuf::from("/jdk/bin/keytool"),
    };

    let removed = java.remove(&local_ca);

    assert!(removed.is_ok(), "{removed:?}");
    let calls = runner.recorded_calls();
    assert_eq!(calls.len(), 1, "{calls:?}");
    assert!(
        calls[0].contains("-list -alias sendmock-local-ca"),
        "{calls:?}"
    );
}

/// A Herd-like PHP: no main php.ini, and a scanned ini that points both CA settings at
/// Herd's own bundle. Answers the PHP and that ini's path.
fn build_herd_php(folder: &std::path::Path) -> (PhpTarget, PathBuf) {
    let herd_bundle = folder.join("herd-cacert.pem");
    let herd_ini = folder.join("herd-php.ini");
    let _ = std::fs::write(
        &herd_bundle,
        "-----BEGIN CERTIFICATE-----\nHERD\n-----END CERTIFICATE-----\n",
    );
    let _ = std::fs::write(
        &herd_ini,
        format!(
            "openssl.cafile={0}\ncurl.cainfo={0}\n",
            herd_bundle.display()
        ),
    );
    let php_binary = "/Herd/bin/php85";
    let probe_output = format!(
        "\n{}\n\n8.5.0\n{}\n",
        herd_bundle.display(),
        herd_ini.display()
    );
    let php = PhpTarget {
        runner: Arc::new(
            FakeCommandRunner::succeeding(&[php_binary]).with_output(php_binary, &probe_output),
        ),
        php_binary: PathBuf::from(php_binary),
    };
    (php, herd_ini)
}

// AC: PL-25.5
#[test]
fn a_php_whose_ca_files_come_from_a_scanned_ini_names_that_file_and_its_settings() {
    let folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let local_ca = build_local_ca(folder.path());
    let (php, herd_ini) = build_herd_php(folder.path());

    let check = php.check(&local_ca);

    assert_eq!(check.state, TrustState::Manual);
    assert!(
        check.detail.contains(&herd_ini.display().to_string())
            && check.detail.contains("openssl.cafile=")
            && check.detail.contains("curl.cainfo="),
        "{}",
        check.detail
    );
}

// AC: PL-25.5
#[test]
fn trust_writes_a_combined_bundle_for_that_php_and_leaves_its_ini_as_it_was() {
    let folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let local_ca = build_local_ca(folder.path());
    let (php, herd_ini) = build_herd_php(folder.path());
    let ini_before = std::fs::read_to_string(&herd_ini).unwrap_or_default();

    let manual_step = php.prepare_manual_step(&local_ca);

    let manual_text = match manual_step {
        Some(Ok(manual_text)) => manual_text,
        other => panic!("a manual step: {other:?}"),
    };
    let bundle_text = std::fs::read_dir(&local_ca.bundle_folder)
        .unwrap_or_else(|error| panic!("{error}"))
        .flatten()
        .map(|bundle_entry| std::fs::read_to_string(bundle_entry.path()).unwrap_or_default())
        .collect::<String>();
    assert!(
        bundle_text.contains("HERD") && bundle_text.contains("AAAA"),
        "{bundle_text}"
    );
    assert!(
        manual_text.contains("Set openssl.cafile and curl.cainfo there"),
        "{manual_text}"
    );
    assert_eq!(
        std::fs::read_to_string(&herd_ini).unwrap_or_default(),
        ini_before
    );
}
