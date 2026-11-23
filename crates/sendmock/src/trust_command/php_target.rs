//! PHP reads its own CA file (`openssl.cafile`, `curl.cainfo`), not the system store, on Herd
//! and Homebrew; each PHP found gets a combined bundle and a block in its `php.ini`.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::command_runner::CommandRunner;
use super::php_ini_block::replace_trust_block;
use super::php_scanned_ini::{describe_settings, find_ca_setting_file};
use super::trust_target::{LocalCa, TrustCheck, TrustState, TrustTarget};

/// Prints the loaded `php.ini`, `openssl.cafile`, OpenSSL's default CA file, the version and
/// the ini files read from the scan folder, comma separated.
const PHP_PROBE: &str = "echo php_ini_loaded_file() ?: '', PHP_EOL, ini_get('openssl.cafile'), PHP_EOL, openssl_get_cert_locations()['default_cert_file'] ?? '', PHP_EOL, PHP_VERSION, PHP_EOL, implode(',', array_map('trim', explode(',', php_ini_scanned_files() ?: ''))), PHP_EOL;";

/// System bundles to combine with when PHP names none it can read.
const SYSTEM_BUNDLES: [&str; 5] = [
    "/etc/ssl/cert.pem",
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
    "/opt/homebrew/etc/ca-certificates/cert.pem",
    "/usr/local/etc/ca-certificates/cert.pem",
];

/// One PHP: its binary and what it reported.
pub struct PhpTarget {
    pub runner: Arc<dyn CommandRunner>,
    pub php_binary: PathBuf,
}

struct PhpSettings {
    loaded_ini: String,
    ca_file: String,
    default_ca_file: String,
    version: String,
    scanned_inis: Vec<String>,
}

/// Every PHP on this machine: the one on `PATH`, Herd's and Homebrew's, each once.
pub fn find_php_targets(runner: &Arc<dyn CommandRunner>) -> Vec<PhpTarget> {
    let home_folder = dirs::home_dir().unwrap_or_default();
    let candidates = [
        runner.find_program("php", &[]),
        Some(home_folder.join("Library/Application Support/Herd/bin/php")),
        Some(PathBuf::from("/opt/homebrew/bin/php")),
        Some(PathBuf::from("/usr/local/bin/php")),
    ];
    let mut php_binaries: Vec<PathBuf> = Vec::new();
    for candidate in candidates.into_iter().flatten() {
        let Ok(resolved_path) = candidate.canonicalize() else {
            continue;
        };
        if !php_binaries.contains(&resolved_path) {
            php_binaries.push(resolved_path);
        }
    }
    php_binaries
        .into_iter()
        .map(|php_binary| PhpTarget {
            runner: Arc::clone(runner),
            php_binary,
        })
        .collect()
}

impl PhpTarget {
    fn read_settings(&self) -> Option<PhpSettings> {
        let outcome = self
            .runner
            .run(&self.php_binary.display().to_string(), &["-r", PHP_PROBE]);
        if !outcome.is_success {
            return None;
        }
        let mut lines = outcome
            .output_text
            .lines()
            .map(str::trim)
            .map(str::to_owned);
        Some(PhpSettings {
            loaded_ini: lines.next().unwrap_or_default(),
            ca_file: lines.next().unwrap_or_default(),
            default_ca_file: lines.next().unwrap_or_default(),
            version: lines.next().unwrap_or_default(),
            scanned_inis: lines
                .next()
                .unwrap_or_default()
                .split(',')
                .map(str::trim)
                .filter(|ini_path| !ini_path.is_empty())
                .map(str::to_owned)
                .collect(),
        })
    }

    fn bundle_path(&self, local_ca: &LocalCa, settings: &PhpSettings) -> PathBuf {
        let ini_key: String = settings
            .loaded_ini
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() {
                    character
                } else {
                    '-'
                }
            })
            .collect();
        let ini_key = ini_key.trim_matches('-');
        let bundle_name = if ini_key.is_empty() {
            format!("php-{}.pem", settings.version)
        } else {
            format!("php-{}-{ini_key}.pem", settings.version)
        };
        local_ca.bundle_folder.join(bundle_name)
    }

    /// The CA file PHP uses now (or a system bundle) with the local CA added, in SendMock's
    /// trust folder, so nothing outside it changes.
    fn write_bundle(&self, local_ca: &LocalCa, settings: &PhpSettings) -> Result<PathBuf, String> {
        let bundle_path = self.bundle_path(local_ca, settings);
        let base_pem = read_base_bundle(settings, &bundle_path)
            .ok_or("no CA bundle to combine with the local CA")?;
        std::fs::create_dir_all(&local_ca.bundle_folder).map_err(|error| error.to_string())?;
        std::fs::write(
            &bundle_path,
            format!("{}\n{}", base_pem.trim_end(), local_ca.certificate_pem),
        )
        .map_err(|error| error.to_string())?;
        Ok(bundle_path)
    }

    fn place_name(&self, settings: Option<&PhpSettings>) -> String {
        match settings {
            Some(settings) => format!("PHP {} ({})", settings.version, self.php_binary.display()),
            None => format!("PHP ({})", self.php_binary.display()),
        }
    }
}

/// What to set by hand for a PHP with no main php.ini: in the scanned file that sets its CA
/// files (Herd's), or in a php.ini of its own.
fn describe_manual_step(settings: &PhpSettings, bundle_path: &Path) -> String {
    let bundle_text = bundle_path.display();
    match find_ca_setting_file(&settings.scanned_inis) {
        Some(ca_setting_file) => format!(
            "It loads no main php.ini; {} sets {}. Set openssl.cafile and curl.cainfo there to {bundle_text} (sendmock trust --bundle-only writes it)",
            ca_setting_file.ini_path,
            describe_settings(&ca_setting_file)
        ),
        None => format!(
            "It loads no php.ini; set openssl.cafile and curl.cainfo to {bundle_text} (sendmock trust --bundle-only writes it)"
        ),
    }
}

/// The CA file PHP uses now, or a system bundle, to keep every other site working.
fn read_base_bundle(settings: &PhpSettings, bundle_path: &Path) -> Option<String> {
    let bundle_text = bundle_path.display().to_string();
    [settings.ca_file.as_str(), settings.default_ca_file.as_str()]
        .into_iter()
        .chain(SYSTEM_BUNDLES)
        .filter(|candidate| !candidate.is_empty() && *candidate != bundle_text)
        .find_map(|candidate| std::fs::read_to_string(candidate).ok())
        .filter(|base_pem| base_pem.contains("BEGIN CERTIFICATE"))
}

/// The CA file PHP reads now: its `openssl.cafile`, or OpenSSL's default when it sets none.
fn effective_ca_file(settings: &PhpSettings) -> &str {
    if settings.ca_file.is_empty() {
        &settings.default_ca_file
    } else {
        &settings.ca_file
    }
}

fn has_local_ca(bundle_path: &str, local_ca: &LocalCa) -> bool {
    std::fs::read_to_string(bundle_path)
        .is_ok_and(|bundle_pem| bundle_pem.contains(local_ca.certificate_pem.trim()))
}

impl TrustTarget for PhpTarget {
    fn check(&self, local_ca: &LocalCa) -> TrustCheck {
        let settings = self.read_settings();
        let place = self.place_name(settings.as_ref());
        let Some(settings) = settings else {
            return TrustCheck {
                place,
                state: TrustState::Manual,
                detail: "It did not run.".to_owned(),
            };
        };
        let ca_file = effective_ca_file(&settings);
        let bundle_path = self.bundle_path(local_ca, &settings);
        let (state, detail) = match (
            has_local_ca(ca_file, local_ca),
            settings.loaded_ini.is_empty(),
        ) {
            (true, _) => (
                TrustState::Trusted,
                format!("Its CA file {ca_file} holds the local CA"),
            ),
            (false, true) => (
                TrustState::Manual,
                describe_manual_step(&settings, &bundle_path),
            ),
            (false, false) => (TrustState::Missing, format!("Its CA file is {ca_file}")),
        };
        TrustCheck {
            place,
            state,
            detail,
        }
    }

    fn add(&self, local_ca: &LocalCa) -> Result<String, String> {
        let settings = self.read_settings().ok_or("PHP did not run")?;
        let ca_file = effective_ca_file(&settings);
        if has_local_ca(ca_file, local_ca) {
            return Ok(format!("Its CA file {ca_file} holds the local CA now."));
        }
        if settings.loaded_ini.is_empty() {
            return Err("this PHP loads no php.ini".to_owned());
        }
        let bundle_path = self.write_bundle(local_ca, &settings)?;
        let ini_text =
            std::fs::read_to_string(&settings.loaded_ini).map_err(|error| error.to_string())?;
        let bundle_text = bundle_path.display().to_string();
        std::fs::write(
            &settings.loaded_ini,
            replace_trust_block(&ini_text, Some(&bundle_text)),
        )
        .map_err(|error| format!("{}: {error}", settings.loaded_ini))?;
        Ok(format!("Pointed {} at {bundle_text}.", settings.loaded_ini))
    }

    fn prepare_manual_step(&self, local_ca: &LocalCa) -> Option<Result<String, String>> {
        let settings = self.read_settings()?;
        if !settings.loaded_ini.is_empty() || has_local_ca(effective_ca_file(&settings), local_ca) {
            return None;
        }
        Some(
            self.write_bundle(local_ca, &settings)
                .map(|bundle_path| describe_manual_step(&settings, &bundle_path)),
        )
    }

    fn write_bundle_only(&self, local_ca: &LocalCa) -> Option<Result<String, String>> {
        let Some(settings) = self.read_settings() else {
            return Some(Err("PHP did not run".to_owned()));
        };
        let place = self.place_name(Some(&settings));
        Some(self.write_bundle(local_ca, &settings).map(|bundle_path| {
            format!(
                "{place}: wrote {}; set openssl.cafile and curl.cainfo to it",
                bundle_path.display()
            )
        }))
    }

    fn remove(&self, local_ca: &LocalCa) -> Result<String, String> {
        let settings = self.read_settings().ok_or("PHP did not run")?;
        if !settings.loaded_ini.is_empty() {
            let ini_text =
                std::fs::read_to_string(&settings.loaded_ini).map_err(|error| error.to_string())?;
            std::fs::write(&settings.loaded_ini, replace_trust_block(&ini_text, None))
                .map_err(|error| format!("{}: {error}", settings.loaded_ini))?;
        }
        let bundle_path = self.bundle_path(local_ca, &settings);
        if bundle_path.exists() {
            std::fs::remove_file(&bundle_path).map_err(|error| error.to_string())?;
        }
        Ok(format!("Removed the block from {}.", settings.loaded_ini))
    }
}
