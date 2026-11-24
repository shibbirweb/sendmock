//! The numbers CSV a preset imports, `number,label,subaccount_sid,messaging_service_sid` per
//! line: read and checked whole before the preset applies anything, so a bad CSV changes
//! nothing, then imported with any Messaging Service it names made first.

use sendmock_store::MessagingServiceRecord;
use serde_json::json;

use crate::numbers::{
    VirtualNumberInput, build_virtual_number, field_error, is_messaging_service_sid,
};
use crate::twilio_accounts::TwilioAccountDirectory;
use crate::{OperationContext, OperationError};

const CSV_FIELD: &str = "numbers_csv";

/// One number line of the CSV.
pub struct NumbersCsvRow {
    line_number: usize,
    csv_line: String,
    number: String,
    label: String,
    account_sid: Option<String>,
    messaging_service_sid: Option<String>,
}

impl NumbersCsvRow {
    fn to_number_input(
        &self,
        messaging_service_sid: Option<&str>,
    ) -> Result<VirtualNumberInput, OperationError> {
        serde_json::from_value(json!({
            "number": self.number, "label": self.label, "channels": ["sms"], "inbound_url": null,
            "inbound_fallback_url": null, "inbound_template_id": "twilio.inbound_sms",
            "status_callback_url": null, "messaging_service_sid": messaging_service_sid,
            "account_sid": self.account_sid,
        }))
        .map_err(|_| {
            field_error(
                CSV_FIELD,
                &format!("Cannot read line {}: {}", self.line_number, self.csv_line),
            )
        })
    }
}

/// The number lines, skipping blank lines and a header line that starts with `number`.
pub fn read_numbers_csv(numbers_csv: &str) -> Vec<NumbersCsvRow> {
    numbers_csv
        .lines()
        .enumerate()
        .map(|(line_index, csv_line)| (line_index + 1, csv_line.trim()))
        .filter(|(_, csv_line)| !csv_line.is_empty())
        .filter(|(_, csv_line)| !csv_line.to_ascii_lowercase().starts_with("number"))
        .map(|(line_number, csv_line)| {
            let mut cells = csv_line.split(',').map(str::trim);
            let number = cells.next().unwrap_or_default().to_owned();
            let label = cells
                .next()
                .filter(|cell| !cell.is_empty())
                .unwrap_or(&number)
                .to_owned();
            NumbersCsvRow {
                line_number,
                csv_line: csv_line.to_owned(),
                number,
                label,
                account_sid: cells
                    .next()
                    .filter(|cell| !cell.is_empty())
                    .map(str::to_owned),
                messaging_service_sid: cells
                    .next()
                    .filter(|cell| !cell.is_empty())
                    .map(str::to_owned),
            }
        })
        .collect()
}

/// Every row's problem (a malformed number, an unknown subaccount, a service SID that is not
/// `MG` and 32 hex digits), checked without changing anything; one error naming each bad line.
pub async fn check_numbers_csv(
    operation_context: &OperationContext,
    csv_rows: &[NumbersCsvRow],
) -> Result<(), OperationError> {
    let mut problems = Vec::new();
    for csv_row in csv_rows {
        if let Some(problem) = find_row_problem(operation_context, csv_row).await? {
            problems.push(format!(
                "line {} ({}): {problem}",
                csv_row.line_number, csv_row.csv_line
            ));
        }
    }
    if problems.is_empty() {
        return Ok(());
    }
    Err(field_error(
        CSV_FIELD,
        &format!(
            "Nothing was applied. Fix these lines: {}",
            problems.join("; ")
        ),
    ))
}

async fn find_row_problem(
    operation_context: &OperationContext,
    csv_row: &NumbersCsvRow,
) -> Result<Option<String>, OperationError> {
    if let Some(service_sid) = &csv_row.messaging_service_sid
        && !is_messaging_service_sid(service_sid)
    {
        return Ok(Some(format!(
            "{service_sid} is not a Messaging Service SID (MG and 32 hex digits)"
        )));
    }
    let existing_number = operation_context
        .virtual_number_repository
        .find_by_number(&csv_row.number)
        .await?;
    let number_input = match csv_row.to_number_input(None) {
        Ok(number_input) => number_input,
        Err(read_error) => return Ok(Some(read_error.to_string())),
    };
    match build_virtual_number(operation_context, number_input, existing_number).await {
        Ok(_) => Ok(None),
        Err(OperationError::InvalidInput { message, .. }) => Ok(Some(message)),
        Err(other_error) => Err(other_error),
    }
}

/// Adds or updates each row's number, first making a Messaging Service it names that does
/// not exist yet, with that SID; answers how many numbers were imported.
pub async fn import_numbers_csv(
    operation_context: &OperationContext,
    csv_rows: &[NumbersCsvRow],
) -> Result<usize, OperationError> {
    for csv_row in csv_rows {
        if let Some(service_sid) = &csv_row.messaging_service_sid {
            ensure_messaging_service(
                operation_context,
                service_sid,
                csv_row.account_sid.as_deref(),
            )
            .await?;
        }
        let number_repository = &operation_context.virtual_number_repository;
        let existing_number = number_repository.find_by_number(&csv_row.number).await?;
        let is_new_number = existing_number.is_none();
        let number_input = csv_row.to_number_input(csv_row.messaging_service_sid.as_deref())?;
        let built_number =
            build_virtual_number(operation_context, number_input, existing_number).await?;
        if is_new_number {
            number_repository.insert_number(built_number).await?;
        } else {
            number_repository.update_number(built_number).await?;
        }
    }
    Ok(csv_rows.len())
}

/// A service the CSV names, made empty for the row's account when it does not exist; the
/// number joins its pool.
async fn ensure_messaging_service(
    operation_context: &OperationContext,
    service_sid: &str,
    account_sid: Option<&str>,
) -> Result<(), OperationError> {
    let service_repository = &operation_context.messaging_service_repository;
    if service_repository
        .find_service(service_sid)
        .await?
        .is_some()
    {
        return Ok(());
    }
    service_repository
        .save_service(MessagingServiceRecord {
            service_sid: service_sid.to_owned(),
            friendly_name: format!("Imported {service_sid}"),
            number_ids: Vec::new(),
            inbound_mode: "defer_to_sender".to_owned(),
            inbound_url: None,
            inbound_fallback_url: None,
            opt_out_keywords: true,
            account_sid: TwilioAccountDirectory::load(operation_context)
                .await?
                .stored_owner_sid(account_sid),
            created_by: "api".to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_header_and_blank_lines_are_skipped_and_each_row_keeps_its_line_number() {
        let csv_rows = read_numbers_csv(
            "number,label,subaccount_sid,messaging_service_sid\n\n+15550001111,Shop,,MG00000000000000000000000000000001\n+15550002222\n",
        );

        assert_eq!(csv_rows.len(), 2);
        assert_eq!(csv_rows[0].line_number, 3);
        assert_eq!(
            csv_rows[0].messaging_service_sid.as_deref(),
            Some("MG00000000000000000000000000000001")
        );
        assert_eq!(csv_rows[1].label, "+15550002222");
        assert_eq!(csv_rows[1].account_sid, None);
    }
}
