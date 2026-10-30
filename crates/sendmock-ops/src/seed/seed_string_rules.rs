/// Keys whose values are secrets, so a seed file may only hold `${ENV_VAR}` references there.
const SECRET_KEYS: [&str; 6] = [
    "secret",
    "password",
    "token",
    "auth_token",
    "api_key",
    "api_secret",
];

/// What is wrong with a string value, if anything: a malformed `${...}` reference, or a
/// secret written in the file instead of referenced from the environment.
pub fn check_seed_string(key: &str, value: &str) -> Option<String> {
    if value.contains("${") && !has_only_valid_references(value) {
        return Some(
            "Write environment references as ${NAME}, with capital letters, digits and underscores"
                .to_owned(),
        );
    }
    if SECRET_KEYS.contains(&key) && !value.is_empty() && !is_single_reference(value) {
        return Some(format!(
            "{key} must be an ${{ENV_VAR}} reference, never the secret itself"
        ));
    }
    None
}

fn is_single_reference(value: &str) -> bool {
    value
        .strip_prefix("${")
        .and_then(|rest| rest.strip_suffix('}'))
        .is_some_and(is_environment_variable_name)
}

fn has_only_valid_references(value: &str) -> bool {
    value.split("${").skip(1).all(|after_opening| {
        after_opening
            .split_once('}')
            .is_some_and(|(variable_name, _)| is_environment_variable_name(variable_name))
    })
}

fn is_environment_variable_name(variable_name: &str) -> bool {
    let mut characters = variable_name.chars();
    characters
        .next()
        .is_some_and(|first| first.is_ascii_uppercase() || first == '_')
        && characters.all(|character| {
            character.is_ascii_uppercase() || character.is_ascii_digit() || character == '_'
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_text_and_valid_references() {
        assert_eq!(check_seed_string("url", "http://localhost:8000/hook"), None);
        assert_eq!(
            check_seed_string("url", "http://${APP_HOST}:8000/hook"),
            None
        );
        assert_eq!(check_seed_string("secret", "${APP_WEBHOOK_SECRET}"), None);
    }

    #[test]
    fn rejects_a_secret_written_in_the_file() {
        assert_eq!(
            check_seed_string("secret", "whsec_abc123"),
            Some("secret must be an ${ENV_VAR} reference, never the secret itself".to_owned())
        );
    }

    #[test]
    fn rejects_a_malformed_reference() {
        assert!(check_seed_string("url", "http://${app_host}/hook").is_some());
        assert!(check_seed_string("url", "http://${APP_HOST/hook").is_some());
        assert!(check_seed_string("secret", "${}").is_some());
    }
}
