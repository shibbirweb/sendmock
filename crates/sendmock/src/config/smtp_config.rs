use std::net::SocketAddr;
use std::path::PathBuf;

use sendmock_core::parse_size_bytes;
use sendmock_smtp::{RecipientPolicy, SmtpAuthMode};

use super::ConfigError;
use super::config_file::ConfigFile;
use crate::cli_arguments::ServeArguments;

pub const DEFAULT_SMTP_MAX_SIZE_BYTES: u64 = 25 * 1024 * 1024;

/// The SMTP listener's settings beyond its address.
#[derive(Debug, Clone, PartialEq)]
pub struct SmtpConfig {
    pub smtps_addr: Option<SocketAddr>,
    pub max_size_bytes: u64,
    pub auth_mode: SmtpAuthMode,
    pub tls_certificate_file: Option<PathBuf>,
    pub tls_key_file: Option<PathBuf>,
    pub is_tls_required: bool,
    /// Offer STARTTLS on the SMTP port. Off by default: many mailers (Symfony Mailer and so
    /// Laravel, Nodemailer, Rails, MailKit) upgrade whenever it is offered and then refuse
    /// the self-signed certificate. On with `--smtp-starttls`, a certificate or require-TLS.
    pub is_starttls_offered: bool,
    pub recipient_policy: RecipientPolicy,
}

impl SmtpConfig {
    /// Flags and environment variables win over the file, which wins over the defaults.
    pub fn resolve(
        serve_arguments: &ServeArguments,
        config_file: &ConfigFile,
    ) -> Result<Self, ConfigError> {
        let (tls_certificate_file, tls_key_file) = resolve_tls_files(serve_arguments, config_file)?;
        let has_certificate = tls_certificate_file.is_some();
        Ok(Self {
            smtps_addr: serve_arguments.smtps_addr.or(config_file.smtps_addr),
            max_size_bytes: resolve_max_size_bytes(serve_arguments, config_file)?,
            auth_mode: resolve_auth_mode(serve_arguments, config_file)?,
            tls_certificate_file,
            tls_key_file,
            is_tls_required: serve_arguments.smtp_require_tls
                || config_file.smtp_require_tls.unwrap_or(false),
            is_starttls_offered: serve_arguments.smtp_starttls
                || config_file.smtp_starttls.unwrap_or(false)
                || serve_arguments.smtp_require_tls
                || config_file.smtp_require_tls.unwrap_or(false)
                || has_certificate,
            recipient_policy: serve_arguments
                .smtp_allow_rcpt
                .as_ref()
                .or(config_file.smtp_allow_rcpt.as_ref())
                .map(|glob_list| RecipientPolicy::from_glob_list(glob_list))
                .unwrap_or_default(),
        })
    }
}

fn resolve_max_size_bytes(
    serve_arguments: &ServeArguments,
    config_file: &ConfigFile,
) -> Result<u64, ConfigError> {
    let Some(size_setting) = serve_arguments
        .smtp_max_size
        .as_ref()
        .or(config_file.smtp_max_size.as_ref())
    else {
        return Ok(DEFAULT_SMTP_MAX_SIZE_BYTES);
    };
    parse_size_bytes(size_setting).ok_or_else(|| ConfigError::InvalidSetting {
        setting_name: "smtp_max_size",
        reason: format!("{size_setting} is not a size such as 25MB"),
    })
}

fn resolve_auth_mode(
    serve_arguments: &ServeArguments,
    config_file: &ConfigFile,
) -> Result<SmtpAuthMode, ConfigError> {
    let Some(auth_setting) = serve_arguments
        .smtp_auth
        .as_ref()
        .or(config_file.smtp_auth.as_ref())
    else {
        return Ok(SmtpAuthMode::AcceptAny);
    };
    SmtpAuthMode::from_setting(auth_setting).map_err(|auth_error| ConfigError::InvalidSetting {
        setting_name: "smtp_auth",
        reason: auth_error.to_string(),
    })
}

/// The certificate and key come as a pair, from the flags or else from the file.
fn resolve_tls_files(
    serve_arguments: &ServeArguments,
    config_file: &ConfigFile,
) -> Result<(Option<PathBuf>, Option<PathBuf>), ConfigError> {
    let tls_files = match (
        &serve_arguments.smtp_tls_cert,
        &serve_arguments.smtp_tls_key,
    ) {
        (Some(certificate_file), Some(key_file)) => {
            (Some(certificate_file.clone()), Some(key_file.clone()))
        }
        _ => (
            config_file.smtp_tls_cert.clone(),
            config_file.smtp_tls_key.clone(),
        ),
    };
    if tls_files.0.is_some() != tls_files.1.is_some() {
        return Err(ConfigError::InvalidSetting {
            setting_name: "smtp_tls_cert",
            reason: "smtp_tls_cert and smtp_tls_key go together".to_owned(),
        });
    }
    Ok(tls_files)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resolve_smtp_config(
        serve_arguments: &ServeArguments,
        config_file: &ConfigFile,
    ) -> SmtpConfig {
        SmtpConfig::resolve(serve_arguments, config_file)
            .unwrap_or_else(|config_error| panic!("{config_error}"))
    }

    #[test]
    fn accepts_25_megabytes_any_auth_and_every_recipient_by_default() {
        let smtp_config = resolve_smtp_config(&ServeArguments::default(), &ConfigFile::default());

        assert_eq!(smtp_config.max_size_bytes, DEFAULT_SMTP_MAX_SIZE_BYTES);
        assert_eq!(smtp_config.auth_mode, SmtpAuthMode::AcceptAny);
        assert!(
            smtp_config
                .recipient_policy
                .is_allowed("anyone@anywhere.test")
        );
        assert!(!smtp_config.is_tls_required);
        assert!(!smtp_config.is_starttls_offered);
        assert_eq!(smtp_config.smtps_addr, None);
    }

    #[test]
    fn a_flag_wins_over_the_file() {
        let serve_arguments = ServeArguments {
            smtp_max_size: Some("1MB".to_owned()),
            smtp_auth: Some("none".to_owned()),
            ..ServeArguments::default()
        };
        let config_file = ConfigFile {
            smtp_max_size: Some("5MB".to_owned()),
            smtp_require_tls: Some(true),
            smtp_allow_rcpt: Some("*@app.test".to_owned()),
            ..ConfigFile::default()
        };

        let smtp_config = resolve_smtp_config(&serve_arguments, &config_file);

        assert_eq!(smtp_config.max_size_bytes, 1024 * 1024);
        assert_eq!(smtp_config.auth_mode, SmtpAuthMode::Disabled);
        assert!(smtp_config.is_tls_required);
        assert!(
            !smtp_config
                .recipient_policy
                .is_allowed("someone@other.test")
        );
    }

    #[test]
    fn rejects_a_size_that_is_not_a_size_and_names_the_setting() {
        let serve_arguments = ServeArguments {
            smtp_max_size: Some("huge".to_owned()),
            ..ServeArguments::default()
        };

        let error_message = SmtpConfig::resolve(&serve_arguments, &ConfigFile::default())
            .err()
            .map(|config_error| config_error.to_string())
            .unwrap_or_default();

        assert!(error_message.contains("smtp_max_size"));
    }

    #[test]
    fn rejects_an_unknown_auth_mode() {
        let config_file = ConfigFile {
            smtp_auth: Some("maybe".to_owned()),
            ..ConfigFile::default()
        };

        assert!(SmtpConfig::resolve(&ServeArguments::default(), &config_file).is_err());
    }

    #[test]
    fn a_certificate_without_its_key_is_an_error() {
        let config_file = ConfigFile {
            smtp_tls_cert: Some(PathBuf::from("cert.pem")),
            ..ConfigFile::default()
        };

        assert!(SmtpConfig::resolve(&ServeArguments::default(), &config_file).is_err());
    }

    // AC: EM-02.1
    #[test]
    fn starttls_is_offered_when_asked_for_or_implied() {
        let asked_for = ServeArguments {
            smtp_starttls: true,
            ..ServeArguments::default()
        };
        let implied_by_require_tls = ConfigFile {
            smtp_require_tls: Some(true),
            ..ConfigFile::default()
        };
        let implied_by_certificate = ConfigFile {
            smtp_tls_cert: Some(PathBuf::from("cert.pem")),
            smtp_tls_key: Some(PathBuf::from("key.pem")),
            ..ConfigFile::default()
        };

        assert!(resolve_smtp_config(&asked_for, &ConfigFile::default()).is_starttls_offered);
        assert!(
            resolve_smtp_config(&ServeArguments::default(), &implied_by_require_tls)
                .is_starttls_offered
        );
        assert!(
            resolve_smtp_config(&ServeArguments::default(), &implied_by_certificate)
                .is_starttls_offered
        );
    }
}
