use std::path::PathBuf;
use std::sync::Arc;

use super::fake_command_runner::FakeCommandRunner;
use super::java_target::JavaTarget;
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
