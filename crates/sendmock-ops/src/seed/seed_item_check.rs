use super::adapters::seed_section_adapters;
use super::environment_references::resolve_environment_references;
use super::seed_document::read_section_items;
use crate::OperationContext;
use crate::setup::SetupSecretOpener;

/// An item an import would refuse before writing, with where it is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeedItemProblem {
    /// The key path, such as `webhook.rules[0]`.
    pub location: String,
    pub message: String,
}

/// Reads every item into its section's type as the import does first, after resolving
/// `${ENV_VAR}` references and, with the passphrase, opening the encrypted secrets; so validate
/// and import refuse the same unknown keys and wrong types.
pub fn check_seed_items(
    operation_context: &OperationContext,
    setup_document: &toml::Table,
    passphrase: Option<&str>,
) -> Vec<SeedItemProblem> {
    let mut seed_value = toml::Value::Table(setup_document.clone());
    resolve_environment_references(
        &mut seed_value,
        operation_context.environment_reader.as_ref(),
        &mut Vec::new(),
    );
    if passphrase.is_some() {
        let _ = SetupSecretOpener::new(passphrase).open_secrets(&mut seed_value);
    }
    let toml::Value::Table(prepared_document) = seed_value else {
        return Vec::new();
    };
    let mut item_problems = Vec::new();
    for section_adapter in seed_section_adapters() {
        let seed_section = section_adapter.section();
        for (item_index, item_table) in read_section_items(&prepared_document, seed_section)
            .iter()
            .enumerate()
        {
            if let Err(item_error) = section_adapter.check_item(item_table) {
                let location = match seed_section.is_item_list {
                    true => format!("{}[{item_index}]", seed_section.section_path),
                    false => seed_section.section_path.to_owned(),
                };
                item_problems.push(SeedItemProblem {
                    location,
                    message: item_error.to_string(),
                });
            }
        }
    }
    item_problems
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use sendmock_core::{FixedClock, SystemIdGenerator};
    use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};

    use super::*;
    use crate::{InstanceDetails, ReleaseChannel};

    fn build_operation_context() -> OperationContext {
        OperationContext::new(
            Arc::new(
                Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
                    .unwrap_or_else(|error| panic!("{error}")),
            ),
            Arc::new(FixedClock::new(1_767_225_600_000)),
            Arc::new(SystemIdGenerator),
            InstanceDetails {
                version: "1.5.0",
                channel: ReleaseChannel::Dev,
                started_at_unix_ms: 1_767_225_600_000,
                http_address: "127.0.0.1:8025".to_owned(),
                smtp_address: "127.0.0.1:1025".to_owned(),
                provider_address: None,
                catcher_address: None,
                pop3_address: None,
                provider_tls: None,
                is_container: false,
            },
        )
    }

    fn parse_document(setup_toml: &str) -> toml::Table {
        toml::from_str(setup_toml).unwrap_or_else(|error| panic!("{error}"))
    }

    // AC: PL-26.1
    #[test]
    fn an_unknown_key_in_a_rule_is_named_with_its_place() {
        let setup_document = parse_document(
            r#"
            [[webhook.rules]]
            name = "Opened"
            events = ["email.opened"]
            colour = "blue"
            "#,
        );

        let item_problems = check_seed_items(&build_operation_context(), &setup_document, None);

        assert_eq!(item_problems.len(), 1, "{item_problems:?}");
        assert_eq!(item_problems[0].location, "webhook.rules[0]");
        assert!(
            item_problems[0].message.contains("colour"),
            "{item_problems:?}"
        );
    }

    #[test]
    fn a_document_without_items_has_no_problems() {
        let item_problems = check_seed_items(&build_operation_context(), &toml::Table::new(), None);

        assert!(item_problems.is_empty());
    }
}
