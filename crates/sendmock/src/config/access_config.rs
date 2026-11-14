use sendmock_api::{AccessControlSettings, UiAuth};

use super::ConfigError;
use super::config_file::ConfigFile;
use crate::cli_arguments::ServeArguments;

/// The docs site, whose API playground calls a local SendMock after the user clicks Connect.
pub const DEFAULT_CORS_ORIGIN: &str = "https://shibbirweb.github.io";

/// UI auth and CORS from flags, environment and the file; flags win.
pub fn resolve_access_control(
    serve_arguments: &ServeArguments,
    config_file: &ConfigFile,
) -> Result<AccessControlSettings, ConfigError> {
    let api_token = serve_arguments
        .api_token
        .clone()
        .or_else(|| config_file.api_token.clone());
    let ui_auth = match serve_arguments
        .ui_auth
        .as_ref()
        .or(config_file.ui_auth.as_ref())
    {
        Some(auth_setting) => Some(UiAuth::from_setting(auth_setting, api_token).map_err(
            |auth_error| ConfigError::InvalidSetting {
                setting_name: "ui_auth",
                reason: auth_error.to_string(),
            },
        )?),
        None => None,
    };
    let cors_origins = serve_arguments
        .cors_origins
        .as_ref()
        .or(config_file.cors_origins.as_ref())
        .map_or_else(
            || vec![DEFAULT_CORS_ORIGIN.to_owned()],
            |origin_list| {
                origin_list
                    .split(',')
                    .map(str::trim)
                    .filter(|origin| !origin.is_empty())
                    .map(str::to_owned)
                    .collect()
            },
        );
    Ok(AccessControlSettings {
        ui_auth,
        cors_origins,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_the_docs_site_and_no_auth_by_default() -> Result<(), ConfigError> {
        let access_control =
            resolve_access_control(&ServeArguments::default(), &ConfigFile::default())?;

        assert_eq!(access_control.cors_origins, [DEFAULT_CORS_ORIGIN]);
        assert!(access_control.ui_auth.is_none());
        Ok(())
    }

    // AC: PL-06.4
    #[test]
    fn an_empty_origin_list_removes_the_docs_site() -> Result<(), ConfigError> {
        let serve_arguments = ServeArguments {
            cors_origins: Some(String::new()),
            ..ServeArguments::default()
        };

        let access_control = resolve_access_control(&serve_arguments, &ConfigFile::default())?;

        assert!(access_control.cors_origins.is_empty());
        Ok(())
    }

    #[test]
    fn a_ui_auth_setting_without_a_password_is_a_config_error() {
        let config_file = ConfigFile {
            ui_auth: Some("admin".to_owned()),
            ..ConfigFile::default()
        };

        let resolved = resolve_access_control(&ServeArguments::default(), &config_file);

        assert!(resolved.is_err_and(|config_error| config_error.to_string().contains("ui_auth")));
    }
}
