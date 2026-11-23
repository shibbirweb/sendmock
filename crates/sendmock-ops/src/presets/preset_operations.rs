use super::preset_catalog::{PRESETS, find_preset};
use super::preset_env_block::{EnvBlockValues, build_env_block};
use super::preset_numbers_csv::{
    NumbersCsvRow, check_numbers_csv, import_numbers_csv, read_numbers_csv,
};
use super::preset_setup_text::{read_option, render_preset_setup};
use super::preset_steps::{ensure_mailgun_signing_key, set_twilio_debugger_url};
use super::preset_wire::{PresetApplyInput, PresetApplyResult, PresetOptionView, StackPreset};
use crate::seed::{apply_seed_document, check_setup_text};
use crate::setup::{SetupFileFormat, SetupImportMode};
use crate::twilio_accounts::TwilioAccountDirectory;
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

pub struct ListPresetsOperation;

impl Operation for ListPresetsOperation {
    type Input = NoInput;
    type Output = Vec<StackPreset>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getPresets",
            method: HttpMethod::Get,
            path: "/api/v1/presets",
            summary: "The stack presets: what each sets up and its options.",
            is_read_only: true,
            cli_usage: "sendmock presets",
            mcp_tool: "sendmock_preset_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        _context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<StackPreset>, OperationError> {
        Ok(PRESETS
            .iter()
            .map(|preset| StackPreset {
                name: preset.name.to_owned(),
                description: preset.description.to_owned(),
                options: preset
                    .options
                    .iter()
                    .map(|preset_option| PresetOptionView {
                        name: preset_option.name.to_owned(),
                        default_value: preset_option.default_value.to_owned(),
                        description: preset_option.description.to_owned(),
                    })
                    .collect(),
            })
            .collect())
    }
}

pub struct ApplyPresetOperation;

impl Operation for ApplyPresetOperation {
    type Input = PresetApplyInput;
    type Output = PresetApplyResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postPresetsByPresetNameApply",
            method: HttpMethod::Post,
            path: "/api/v1/presets/{presetName}/apply",
            summary: "Set SendMock up for a stack in one step; a second run changes nothing.",
            cli_usage: "sendmock preset <presetName>",
            mcp_tool: "sendmock_preset_apply",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PresetApplyInput,
    ) -> Result<PresetApplyResult, OperationError> {
        let preset =
            find_preset(input.preset_name.trim()).ok_or_else(|| OperationError::NotFound {
                message: format!("No preset named {}", input.preset_name),
            })?;
        let setup_text = render_preset_setup(preset, &input.app_url, &input.options)?;
        let csv_rows = read_numbers_csv(input.numbers_csv.as_deref().unwrap_or_default());
        check_numbers_csv(operation_context, &csv_rows).await?;
        let setup_check = check_setup_text(&setup_text, SetupFileFormat::Toml);
        let applied = setup_check.into_seed_validation().summary;
        apply_seed_document(operation_context, &setup_text, None, SetupImportMode::Merge).await?;
        let app_url = input.app_url.trim().trim_end_matches('/');
        let mut steps =
            run_preset_steps(operation_context, &input, app_url, preset, &csv_rows).await?;
        let (signing_key, is_new_key) = ensure_mailgun_signing_key(operation_context).await?;
        steps.insert(
            0,
            if is_new_key {
                "Made the Mailgun signing key.".to_owned()
            } else {
                "Kept the Mailgun signing key.".to_owned()
            },
        );
        build_apply_result(operation_context, preset.name, applied, steps, &signing_key).await
    }
}

async fn run_preset_steps(
    operation_context: &OperationContext,
    input: &PresetApplyInput,
    app_url: &str,
    preset: &super::preset_catalog::PresetDefinition,
    csv_rows: &[NumbersCsvRow],
) -> Result<Vec<String>, OperationError> {
    let debugger_path = read_option(preset, &input.options, "twilio_debugger_path");
    let mut steps = vec![
        set_twilio_debugger_url(operation_context, &format!("{app_url}{debugger_path}")).await?,
    ];
    if !csv_rows.is_empty() {
        let imported_count = import_numbers_csv(operation_context, csv_rows).await?;
        steps.push(format!(
            "Added or updated {imported_count} numbers from the CSV."
        ));
    }
    Ok(steps)
}

async fn build_apply_result(
    operation_context: &OperationContext,
    preset_name: &str,
    applied: Vec<crate::seed::SeedItemCount>,
    steps: Vec<String>,
    signing_key: &str,
) -> Result<PresetApplyResult, OperationError> {
    let instance_details = &operation_context.instance_details;
    let provider_tls_address = instance_details
        .provider_tls
        .as_ref()
        .map(|provider_tls| provider_tls.address.clone());
    let (mailgun_endpoint, mailgun_scheme, warnings) =
        choose_mailgun_endpoint(instance_details, provider_tls_address.as_deref());
    let twilio_account = TwilioAccountDirectory::load(operation_context)
        .await?
        .main_account;
    let env_block = build_env_block(
        operation_context,
        &EnvBlockValues {
            mailgun_endpoint: &mailgun_endpoint,
            mailgun_scheme,
            signing_key,
            twilio_account_sid: &twilio_account.account_sid,
            twilio_auth_token: &twilio_account.auth_token,
        },
    );
    Ok(PresetApplyResult {
        preset_name: preset_name.to_owned(),
        applied,
        steps,
        smtp_address: instance_details.smtp_address.clone(),
        provider_address: instance_details.provider_address.clone(),
        provider_tls_address,
        warnings,
        env_block,
    })
}

/// Where Laravel's mailgun mailer is pointed: the HTTPS provider port when on; the plain one,
/// with what to turn on, when not.
fn choose_mailgun_endpoint(
    instance_details: &crate::InstanceDetails,
    provider_tls_address: Option<&str>,
) -> (String, &'static str, Vec<String>) {
    let mut warnings = Vec::new();
    if instance_details.provider_address.is_none() {
        warnings.push(
            "The provider port is off: start SendMock without --provider-addr none.".to_owned(),
        );
    }
    if let Some(tls_address) = provider_tls_address {
        return (tls_address.to_owned(), "https", warnings);
    }
    warnings.push("Laravel's mailgun mailer only speaks HTTPS: start SendMock with --provider-tls-addr 127.0.0.1:8027 and run sendmock trust.".to_owned());
    let plain_address = instance_details
        .provider_address
        .clone()
        .unwrap_or_else(|| "127.0.0.1:8026".to_owned());
    (plain_address, "http", warnings)
}
