use super::setup_header::SetupHeader;
use super::setup_migration::upgrade_setup_document;
use super::setup_version_policy::{SetupVersionDecision, SetupVersionPolicy};
use crate::{OperationContext, OperationError};

/// A parsed setup file in this build's format, and what was done to get it there.
#[derive(Debug, Clone, PartialEq)]
pub struct PreparedSetup {
    pub setup_document: toml::Table,
    pub version_decision: SetupVersionDecision,
}

/// Refuses a format this build cannot read before anything is applied, and upgrades an older
/// format in memory; the user's file is never changed.
pub fn prepare_setup_document(
    operation_context: &OperationContext,
    mut setup_document: toml::Table,
) -> Result<PreparedSetup, OperationError> {
    let version_policy = SetupVersionPolicy::default();
    let setup_header = SetupHeader::read(&setup_document);
    let version_decision = version_policy.decide(&setup_header);
    let instance_details = &operation_context.instance_details;
    let update_version = setup_header.exported_by.as_deref().unwrap_or("latest");
    let upgrade_command = operation_context
        .machine
        .update_checker
        .build_upgrade_command_to(instance_details.channel, update_version);
    if let Some(refusal) = version_policy.describe_refusal(
        &version_decision,
        instance_details.version,
        upgrade_command.as_deref(),
    ) {
        let code = match version_decision {
            SetupVersionDecision::TooOld { .. } => "setup_too_old",
            _ => "setup_too_new",
        };
        return Err(OperationError::Unprocessable {
            code,
            message: refusal,
        });
    }
    if let SetupVersionDecision::Upgrade {
        from_format_version,
        to_format_version,
    } = version_decision
    {
        upgrade_setup_document(&mut setup_document, from_format_version, to_format_version);
        tracing::info!(
            from_format_version,
            to_format_version,
            "upgraded the setup file in memory"
        );
    }
    Ok(PreparedSetup {
        setup_document,
        version_decision,
    })
}
