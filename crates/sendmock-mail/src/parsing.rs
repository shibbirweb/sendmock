mod mime_tree;
mod parsed_email;

pub use mime_tree::MimeTreeNode;
pub use parsed_email::{ParsedAttachment, ParsedEmail, parse_email};
