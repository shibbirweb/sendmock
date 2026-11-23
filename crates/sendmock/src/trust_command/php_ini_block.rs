//! The block `sendmock trust` adds to a `php.ini`, between two marker lines so it can be
//! replaced on the next run and removed by `--undo` without touching anything else.

const BLOCK_START: &str = "; sendmock trust start: the local CA for SendMock's HTTPS provider port";
const BLOCK_END: &str = "; sendmock trust end";

/// The text without the block, then the block pointing at `bundle_path` when given. Later
/// directives win in `php.ini`, so the block at the end overrides an earlier `openssl.cafile`.
pub fn replace_trust_block(ini_text: &str, bundle_path: Option<&str>) -> String {
    let mut kept_lines: Vec<&str> = Vec::new();
    let mut is_inside_block = false;
    for line in ini_text.lines() {
        if line.trim() == BLOCK_START {
            is_inside_block = true;
            continue;
        }
        if is_inside_block {
            if line.trim() == BLOCK_END {
                is_inside_block = false;
            }
            continue;
        }
        kept_lines.push(line);
    }
    while kept_lines.last().is_some_and(|line| line.trim().is_empty()) {
        kept_lines.pop();
    }
    let mut updated_text = kept_lines.join("\n");
    if let Some(bundle_path) = bundle_path {
        updated_text.push_str(&format!(
            "\n\n{BLOCK_START}\nopenssl.cafile=\"{bundle_path}\"\ncurl.cainfo=\"{bundle_path}\"\n{BLOCK_END}"
        ));
    }
    updated_text.push('\n');
    updated_text
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-25.3
    #[test]
    fn the_block_is_added_once_replaced_and_removed_without_touching_the_rest() {
        let original = "memory_limit=512M\nopenssl.cafile=/etc/old.pem\n";

        let added = replace_trust_block(original, Some("/data/php.pem"));
        let added_again = replace_trust_block(&added, Some("/data/php.pem"));
        let removed = replace_trust_block(&added_again, None);

        assert!(added.contains("openssl.cafile=\"/data/php.pem\""));
        assert!(added.contains("curl.cainfo=\"/data/php.pem\""));
        assert_eq!(added, added_again);
        assert_eq!(removed, original);
    }
}
