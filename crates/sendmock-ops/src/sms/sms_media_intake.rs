use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use sendmock_mail::guess_content_type;
use sendmock_store::SmsMediaRecord;

use super::sms_inputs::InlineSmsMedia;
use crate::{OperationContext, OperationError};

/// Twilio's MMS limits, which SendMock keeps so tests catch what the provider would refuse.
pub const MAXIMUM_MEDIA_ITEMS: usize = 10;
pub const MAXIMUM_MEDIA_BYTES: usize = 5 * 1024 * 1024;

/// Media ready to store: each file's description and bytes, in order.
#[derive(Debug, Clone, Default)]
pub struct AcceptedMedia {
    pub media: Vec<SmsMediaRecord>,
    pub contents: Vec<Vec<u8>>,
}

/// Why media was refused: a field error (400) or a link that could not be fetched (Twilio 11200).
#[derive(Debug)]
pub enum MediaProblem {
    Invalid(OperationError),
    Unfetchable(String),
}

fn invalid(field: String, message: String) -> MediaProblem {
    MediaProblem::Invalid(OperationError::InvalidInput {
        message,
        field: Some(field),
    })
}

/// Decodes inline files and downloads links, within the item and size limits (SM-15).
pub async fn accept_media(
    operation_context: &OperationContext,
    inline_media: &[InlineSmsMedia],
    media_urls: &[String],
) -> Result<AcceptedMedia, MediaProblem> {
    if inline_media.len() + media_urls.len() > MAXIMUM_MEDIA_ITEMS {
        return Err(invalid(
            "media".to_owned(),
            format!("At most {MAXIMUM_MEDIA_ITEMS} media items"),
        ));
    }
    let mut accepted_media = AcceptedMedia::default();
    decode_inline_media(&mut accepted_media, inline_media)?;
    for media_url in media_urls {
        let fetched_media = fetch_media(operation_context, media_url).await?;
        let content_type = fetched_media
            .content_type
            .unwrap_or_else(|| guess_content_type(media_url));
        let filename = media_url
            .rsplit('/')
            .next()
            .filter(|name| !name.is_empty())
            .map(str::to_owned);
        push_media(
            &mut accepted_media,
            content_type,
            filename,
            Some(media_url.clone()),
            fetched_media.bytes,
        );
    }
    let total_bytes: usize = accepted_media.contents.iter().map(Vec::len).sum();
    if total_bytes > MAXIMUM_MEDIA_BYTES {
        return Err(invalid(
            "media".to_owned(),
            "media goes over the 5 MB limit".to_owned(),
        ));
    }
    Ok(accepted_media)
}

fn decode_inline_media(
    accepted_media: &mut AcceptedMedia,
    inline_media: &[InlineSmsMedia],
) -> Result<(), MediaProblem> {
    for (inline_index, inline_file) in inline_media.iter().enumerate() {
        let filename = inline_file
            .filename
            .clone()
            .filter(|filename| !filename.trim().is_empty())
            .ok_or_else(|| {
                invalid(
                    format!("media[{inline_index}].filename"),
                    format!("media[{inline_index}].filename is required"),
                )
            })?;
        let bytes = BASE64.decode(inline_file.content.trim()).map_err(|_| {
            invalid(
                format!("media[{inline_index}].content"),
                format!("media[{inline_index}].content is not valid base64"),
            )
        })?;
        let content_type = inline_file
            .content_type
            .clone()
            .unwrap_or_else(|| guess_content_type(&filename));
        push_media(accepted_media, content_type, Some(filename), None, bytes);
    }
    Ok(())
}

async fn fetch_media(
    operation_context: &OperationContext,
    media_url: &str,
) -> Result<super::FetchedMedia, MediaProblem> {
    let unfetchable = |reason: String| {
        MediaProblem::Unfetchable(format!("Could not fetch {media_url}: {reason}"))
    };
    let media_fetcher = operation_context
        .media_fetcher
        .as_ref()
        .ok_or_else(|| unfetchable("this SendMock cannot fetch media links".to_owned()))?;
    media_fetcher
        .fetch_media(media_url, MAXIMUM_MEDIA_BYTES)
        .await
        .map_err(unfetchable)
}

fn push_media(
    accepted_media: &mut AcceptedMedia,
    content_type: String,
    filename: Option<String>,
    source_url: Option<String>,
    bytes: Vec<u8>,
) {
    accepted_media.media.push(SmsMediaRecord {
        media_index: u32::try_from(accepted_media.media.len()).unwrap_or(u32::MAX),
        content_type,
        filename,
        source_url,
        size_bytes: bytes.len() as u64,
    });
    accepted_media.contents.push(bytes);
}
