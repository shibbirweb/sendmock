use mail_parser::MessagePart;
use serde::{Deserialize, Serialize};

/// One node of a message's multipart structure, as the MIME tab shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MimeTreeNode {
    pub part_id: String,
    pub content_type: String,
    pub transfer_encoding: Option<String>,
    pub charset: Option<String>,
    pub size_bytes: u64,
    pub filename: Option<String>,
    pub content_id: Option<String>,
    pub children: Vec<MimeTreeNode>,
}

/// Builds the tree from the root part; part ids are dotted positions (`1`, `1.2`).
pub fn build_mime_tree(part: MessagePart<'_>, part_id: String) -> MimeTreeNode {
    let content_type = part.content_type().map_or_else(
        || "text/plain".to_owned(),
        |content_type| match content_type.subtype() {
            Some(subtype) => format!("{}/{}", content_type.ctype(), subtype).to_lowercase(),
            None => content_type.ctype().to_lowercase(),
        },
    );
    let children = part
        .children()
        .enumerate()
        .map(|(child_position, child_part)| {
            build_mime_tree(child_part, format!("{part_id}.{}", child_position + 1))
        })
        .collect();
    MimeTreeNode {
        content_type,
        transfer_encoding: part.content_transfer_encoding().map(str::to_lowercase),
        charset: part
            .content_type()
            .and_then(|content_type| content_type.attribute("charset"))
            .map(str::to_lowercase),
        size_bytes: u64::try_from(part.raw_body().len()).unwrap_or_default(),
        filename: part.attachment_name().map(str::to_owned),
        content_id: part.content_id().map(str::to_owned),
        children,
        part_id,
    }
}
