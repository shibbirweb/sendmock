use std::collections::HashSet;

/// The parts of a gateway the rules read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentGatewayDraft {
    pub name: String,
    pub accent: String,
    pub method_keys: Vec<String>,
    pub credential_names: Vec<String>,
    pub redirect_field_names: Vec<String>,
    pub header_names: Vec<String>,
}

/// The first thing wrong with a gateway: the field and what to do about it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GatewayProblem {
    pub field: String,
    pub message: String,
}

fn problem(field: &str, message: impl Into<String>) -> GatewayProblem {
    GatewayProblem {
        field: field.to_owned(),
        message: message.into(),
    }
}

fn is_definition_key(definition_key: &str) -> bool {
    let mut characters = definition_key.chars();
    (2..=32).contains(&definition_key.len())
        && characters
            .next()
            .is_some_and(|first| first.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_'
        })
}

fn find_duplicate(names: &[String]) -> Option<String> {
    let mut seen_names = HashSet::new();
    names
        .iter()
        .find(|name| !seen_names.insert(name.as_str()))
        .cloned()
}

/// Names of credential, redirect field and header rows: present, letters, digits, `_`, `.` or
/// `-`, and each once (ignoring case).
fn check_row_names(field: &str, row_label: &str, names: &[String]) -> Result<(), GatewayProblem> {
    if names.iter().any(|row_name| row_name.trim().is_empty()) {
        return Err(problem(field, format!("Every {row_label} needs a name")));
    }
    if let Some(bad_name) = names.iter().find(|row_name| {
        !row_name.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '.' | '-')
        })
    }) {
        return Err(problem(
            field,
            format!("{bad_name} is not a valid name: use letters, digits, _, . or -"),
        ));
    }
    let lowercase_names: Vec<String> = names
        .iter()
        .map(|row_name| row_name.to_lowercase())
        .collect();
    if let Some(duplicate_name) = find_duplicate(&lowercase_names) {
        return Err(problem(field, format!("{duplicate_name} appears twice")));
    }
    Ok(())
}

/// The key and name of a new gateway.
pub fn check_new_gateway(
    gateway_key: &str,
    gateway_name: &str,
    existing_keys: &[String],
) -> Result<(), GatewayProblem> {
    if !is_definition_key(gateway_key) {
        return Err(problem(
            "key",
            "Use 2 to 32 lowercase letters, digits or _, starting with a letter",
        ));
    }
    if existing_keys
        .iter()
        .any(|existing_key| existing_key == gateway_key)
    {
        return Err(problem(
            "key",
            format!("A gateway with the key {gateway_key} already exists"),
        ));
    }
    if gateway_name.trim().is_empty() {
        return Err(problem("name", "Enter a name"));
    }
    Ok(())
}

/// The rules the Gateways screen and the API share; template problems come from rendering.
pub fn check_payment_gateway(gateway_draft: &PaymentGatewayDraft) -> Result<(), GatewayProblem> {
    if gateway_draft.name.trim().is_empty() {
        return Err(problem("name", "Enter a name"));
    }
    let accent = &gateway_draft.accent;
    let is_hex_colour = accent.len() == 7
        && accent.starts_with('#')
        && accent[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit());
    if !is_hex_colour {
        return Err(problem("accent", "Use a colour like #1e5bb8"));
    }
    if gateway_draft.method_keys.is_empty() {
        return Err(problem("method_keys", "Offer at least one method"));
    }
    if find_duplicate(&gateway_draft.method_keys).is_some() {
        return Err(problem("method_keys", "Each method is offered once"));
    }
    check_row_names("credentials", "credential", &gateway_draft.credential_names)?;
    check_row_names(
        "redirect_fields",
        "redirect field",
        &gateway_draft.redirect_field_names,
    )?;
    check_row_names(
        "notification_headers",
        "header",
        &gateway_draft.header_names,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(row_names: &[&str]) -> Vec<String> {
        row_names
            .iter()
            .map(|row_name| (*row_name).to_owned())
            .collect()
    }

    fn nagad_gateway() -> PaymentGatewayDraft {
        PaymentGatewayDraft {
            name: "Nagad".to_owned(),
            accent: "#ec1c24".to_owned(),
            method_keys: names(&["nagad"]),
            credential_names: names(&["merchant_id", "private_key"]),
            redirect_field_names: names(&["payment_ref_id", "status"]),
            header_names: names(&["X-Signature"]),
        }
    }

    fn field_of(gateway_draft: &PaymentGatewayDraft) -> Option<(String, String)> {
        check_payment_gateway(gateway_draft)
            .err()
            .map(|gateway_problem| (gateway_problem.field, gateway_problem.message))
    }

    #[test]
    fn accepts_a_gateway_that_follows_the_rules() {
        assert_eq!(field_of(&nagad_gateway()), None);
    }

    #[test]
    fn refuses_missing_duplicate_or_badly_named_rows() {
        let mut no_methods = nagad_gateway();
        no_methods.method_keys.clear();
        assert_eq!(
            field_of(&no_methods).map(|(field, _)| field),
            Some("method_keys".to_owned())
        );
        let mut repeated_header = nagad_gateway();
        repeated_header.header_names = names(&["X-Sig", "x-sig"]);
        assert_eq!(
            field_of(&repeated_header),
            Some((
                "notification_headers".to_owned(),
                "x-sig appears twice".to_owned()
            ))
        );
        let mut spaced_field = nagad_gateway();
        spaced_field.redirect_field_names = names(&["tran id"]);
        assert!(field_of(&spaced_field).is_some_and(|(field, _)| field == "redirect_fields"));
    }

    #[test]
    fn a_new_gateway_needs_a_free_key_and_a_name() {
        let existing_keys = names(&["stripe"]);
        assert!(check_new_gateway("nagad", "Nagad", &existing_keys).is_ok());
        assert_eq!(
            check_new_gateway("stripe", "Stripe 2", &existing_keys)
                .err()
                .map(|gateway_problem| gateway_problem.field),
            Some("key".to_owned())
        );
        assert_eq!(
            check_new_gateway("nagad", " ", &existing_keys)
                .err()
                .map(|gateway_problem| gateway_problem.field),
            Some("name".to_owned())
        );
    }
}
