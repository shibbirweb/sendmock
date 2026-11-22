use crate::{OperationContext, OperationError};

/// Where opt-outs apply for one of your numbers: STOP is kept under the Messaging Service the
/// number is in (or the number), and sends check the number and every service involved.
pub struct OptOutScope {
    pub stop_sender: String,
    pub senders: Vec<String>,
}

/// The scope for your number and, for a send, the Messaging Service it names; `None` when the
/// number or one of those services has opt-out keywords off.
pub async fn resolve_opt_out_scope(
    operation_context: &OperationContext,
    app_number: &str,
    named_service_sid: Option<&str>,
) -> Result<Option<OptOutScope>, OperationError> {
    let registered_number = operation_context
        .virtual_number_repository
        .find_by_number(app_number)
        .await?;
    if registered_number
        .as_ref()
        .is_some_and(|registered_number| !registered_number.opt_out_keywords)
    {
        return Ok(None);
    }
    let pool_service_sid =
        registered_number.and_then(|registered_number| registered_number.messaging_service_sid);
    let mut service_sids: Vec<String> = pool_service_sid.iter().cloned().collect();
    service_sids.extend(named_service_sid.map(str::to_owned));
    for service_sid in &service_sids {
        let stored_service = operation_context
            .messaging_service_repository
            .find_service(service_sid)
            .await?;
        if stored_service.is_some_and(|stored_service| !stored_service.opt_out_keywords) {
            return Ok(None);
        }
    }
    let mut senders = vec![app_number.to_owned()];
    senders.extend(service_sids);
    Ok(Some(OptOutScope {
        stop_sender: pool_service_sid.unwrap_or_else(|| app_number.to_owned()),
        senders,
    }))
}
