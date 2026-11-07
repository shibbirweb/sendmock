use std::collections::HashMap;

/// Reads a `user:password` file, one login per line; blank lines and `#` comments are skipped.
/// Used by `--smtp-auth file:<path>` and `--pop3-auth file:<path>`.
pub fn read_credentials_file(file_path: &str) -> std::io::Result<HashMap<String, String>> {
    let file_text = std::fs::read_to_string(file_path)?;
    Ok(parse_credentials(&file_text))
}

fn parse_credentials(file_text: &str) -> HashMap<String, String> {
    file_text
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with('#'))
        .filter_map(|line| line.split_once(':'))
        .map(|(username, password)| (username.trim().to_owned(), password.trim().to_owned()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_line_is_a_login_and_comments_and_blank_lines_are_skipped() {
        let credentials =
            parse_credentials("# team logins\nshop: s3cret\n\nblog:pass:word\nno-colon\n");

        assert_eq!(credentials.len(), 2);
        assert_eq!(credentials.get("shop").map(String::as_str), Some("s3cret"));
        assert_eq!(
            credentials.get("blog").map(String::as_str),
            Some("pass:word")
        );
    }
}
