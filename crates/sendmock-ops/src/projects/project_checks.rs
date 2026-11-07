use sendmock_store::{DEFAULT_PROJECT_KEY, ProjectRecord};

use crate::{OperationContext, OperationError};

const MAX_PROJECT_KEY_LENGTH: usize = 40;

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// A key apps can send in an SMTP username, a header and a URL path without escaping.
pub fn check_project_key(project_key: &str) -> Result<(), OperationError> {
    let starts_with_letter_or_digit = project_key
        .chars()
        .next()
        .is_some_and(|first_character| first_character.is_ascii_alphanumeric());
    let has_only_key_characters = project_key.chars().all(|key_character| {
        key_character.is_ascii_lowercase() || key_character.is_ascii_digit() || key_character == '-'
    });
    if !starts_with_letter_or_digit
        || !has_only_key_characters
        || project_key.len() > MAX_PROJECT_KEY_LENGTH
    {
        return Err(field_error(
            "key",
            "Use 1 to 40 lowercase letters, digits and dashes, starting with a letter or digit",
        ));
    }
    Ok(())
}

pub fn check_project_name(project_name: &str) -> Result<(), OperationError> {
    if project_name.trim().is_empty() {
        return Err(field_error("name", "Enter a name"));
    }
    Ok(())
}

pub fn refuse_default_project(project_key: &str) -> Result<(), OperationError> {
    if project_key == DEFAULT_PROJECT_KEY {
        return Err(OperationError::Conflict {
            code: "default_project",
            message:
                "The default project holds traffic sent to no other project and cannot be deleted"
                    .to_owned(),
        });
    }
    Ok(())
}

pub fn project_not_found(project_key: &str) -> OperationError {
    OperationError::NotFound {
        message: format!("No project with key {project_key}"),
    }
}

pub async fn find_project_or_not_found(
    operation_context: &OperationContext,
    project_key: &str,
) -> Result<ProjectRecord, OperationError> {
    operation_context
        .project_repository
        .find_project(project_key)
        .await?
        .ok_or_else(|| project_not_found(project_key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_of_lowercase_letters_digits_and_dashes_are_accepted() {
        for project_key in ["shop", "shop-api", "team2", "9lives", &"a".repeat(40)] {
            assert!(check_project_key(project_key).is_ok(), "{project_key}");
        }
    }

    #[test]
    fn keys_apps_could_not_send_as_they_are_are_refused() {
        for project_key in [
            "",
            "Shop",
            "-shop",
            "shop api",
            "shop_api",
            "shöp",
            &"a".repeat(41),
        ] {
            assert!(check_project_key(project_key).is_err(), "{project_key}");
        }
    }
}
