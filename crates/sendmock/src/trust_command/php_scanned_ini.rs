//! A PHP with no main `php.ini` (Herd) can still take its CA files from an ini file in its scan
//! folder; that file decides what PHP trusts, so the check names it.

const CA_SETTING_NAMES: [&str; 2] = ["openssl.cafile", "curl.cainfo"];

/// The scanned ini file that sets PHP's CA files, and each setting it gives.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaSettingFile {
    pub ini_path: String,
    pub settings: Vec<(String, String)>,
}

/// The last scanned file that sets `openssl.cafile` or `curl.cainfo`, as PHP reads the files
/// in order and a later one wins.
pub fn find_ca_setting_file(scanned_ini_paths: &[String]) -> Option<CaSettingFile> {
    scanned_ini_paths.iter().rev().find_map(|ini_path| {
        let ini_text = std::fs::read_to_string(ini_path).ok()?;
        let settings = read_ca_settings(&ini_text);
        (!settings.is_empty()).then(|| CaSettingFile {
            ini_path: ini_path.clone(),
            settings,
        })
    })
}

fn read_ca_settings(ini_text: &str) -> Vec<(String, String)> {
    ini_text
        .lines()
        .map(str::trim)
        .filter(|line| !line.starts_with(';'))
        .filter_map(|line| line.split_once('='))
        .map(|(setting_name, setting_value)| {
            (
                setting_name.trim().to_owned(),
                setting_value.trim().trim_matches('"').to_owned(),
            )
        })
        .filter(|(setting_name, _)| CA_SETTING_NAMES.contains(&setting_name.as_str()))
        .collect()
}

/// `openssl.cafile=/path` lines for the file, as the check and `sendmock trust` print them.
pub fn describe_settings(ca_setting_file: &CaSettingFile) -> String {
    ca_setting_file
        .settings
        .iter()
        .map(|(setting_name, setting_value)| format!("{setting_name}={setting_value}"))
        .collect::<Vec<String>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-25.5
    #[test]
    fn the_last_scanned_file_that_sets_a_ca_file_is_named_with_its_settings() {
        let scan_folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let early_ini = scan_folder.path().join("10-early.ini");
        let herd_ini = scan_folder.path().join("php.ini");
        let other_ini = scan_folder.path().join("zz-xdebug.ini");
        std::fs::write(&early_ini, "openssl.cafile=/old/cacert.pem\n")
            .unwrap_or_else(|error| panic!("{error}"));
        std::fs::write(
            &herd_ini,
            "; Herd\nmemory_limit=512M\nopenssl.cafile=\"/Herd/cacert.pem\"\ncurl.cainfo=/Herd/cacert.pem\n",
        )
        .unwrap_or_else(|error| panic!("{error}"));
        std::fs::write(&other_ini, "zend_extension=xdebug.so\n")
            .unwrap_or_else(|error| panic!("{error}"));
        let scanned = [&early_ini, &herd_ini, &other_ini]
            .map(|ini_path| ini_path.display().to_string())
            .to_vec();

        let ca_setting_file = find_ca_setting_file(&scanned);

        assert_eq!(
            ca_setting_file.as_ref().map(|file| file.ini_path.clone()),
            Some(herd_ini.display().to_string())
        );
        assert_eq!(
            ca_setting_file.as_ref().map(describe_settings),
            Some("openssl.cafile=/Herd/cacert.pem, curl.cainfo=/Herd/cacert.pem".to_owned())
        );
    }

    #[test]
    fn no_scanned_file_that_sets_a_ca_file_names_none() {
        assert_eq!(
            find_ca_setting_file(&["/no/such/file.ini".to_owned()]),
            None
        );
        assert_eq!(find_ca_setting_file(&[]), None);
    }
}
