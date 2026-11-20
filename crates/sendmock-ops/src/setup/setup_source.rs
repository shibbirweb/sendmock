use super::setup_download::{SetupUrlSource, describe_url_for_log, download_setup};
use super::setup_fetcher::SetupRequestHeader;
use super::setup_file_format::SetupFileFormat;
use super::setup_wire::SetupImportRequest;
use crate::{OperationContext, OperationError};

/// A setup's text from the request, downloaded when it names a URL, and the format to read
/// it in.
pub struct ResolvedSetupSource {
    pub setup_text: String,
    pub setup_format: SetupFileFormat,
    /// Where it came from, for the seed status: the URL without its query.
    pub source_label: Option<String>,
}

/// Takes `setup_text` or `url`, never both. The format is the request's, else the one the
/// URL or its content type names, else detected from the text.
pub async fn resolve_setup_source(
    operation_context: &OperationContext,
    import_request: &SetupImportRequest,
) -> Result<ResolvedSetupSource, OperationError> {
    let source_url = import_request
        .url
        .as_deref()
        .map(str::trim)
        .filter(|url| !url.is_empty());
    match (import_request.setup_text.as_deref(), source_url) {
        (Some(_), Some(_)) => Err(OperationError::InvalidInput {
            message: "Give setup_text or url, not both".to_owned(),
            field: Some("url".to_owned()),
        }),
        (None, None) => Err(OperationError::InvalidInput {
            message: "Give the setup's text in setup_text, or a url to download it from".to_owned(),
            field: Some("setup_text".to_owned()),
        }),
        (Some(setup_text), None) => Ok(ResolvedSetupSource {
            setup_format: import_request
                .format
                .unwrap_or_else(|| SetupFileFormat::detect(setup_text)),
            setup_text: setup_text.to_owned(),
            source_label: None,
        }),
        (None, Some(source_url)) => {
            download_source(operation_context, import_request, source_url).await
        }
    }
}

async fn download_source(
    operation_context: &OperationContext,
    import_request: &SetupImportRequest,
    source_url: &str,
) -> Result<ResolvedSetupSource, OperationError> {
    let headers = import_request
        .headers
        .iter()
        .map(|header_line| SetupRequestHeader::parse(header_line))
        .collect::<Result<Vec<_>, _>>()?;
    let downloaded_setup = download_setup(
        operation_context,
        &SetupUrlSource {
            url: source_url.to_owned(),
            sha256: import_request.sha256.clone(),
            headers,
        },
    )
    .await?;
    let setup_format = import_request
        .format
        .or(downloaded_setup.named_format)
        .unwrap_or_else(|| SetupFileFormat::detect(&downloaded_setup.setup_text));
    Ok(ResolvedSetupSource {
        setup_format,
        setup_text: downloaded_setup.setup_text,
        source_label: Some(describe_url_for_log(source_url)),
    })
}
