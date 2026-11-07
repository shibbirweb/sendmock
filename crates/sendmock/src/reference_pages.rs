//! The generated reference pages in `docs/wiki/reference/`: each is rendered from the code here
//! and compared with the committed page, so the docs cannot drift from the binary.
//! `SENDMOCK_UPDATE_REFERENCE=1 cargo test -p sendmock reference_pages` rewrites them.

mod configuration_flags_page;
mod magic_numbers_page;
mod markdown_table;
mod template_filters_page;
mod webhook_templates_page;

use std::fs;
use std::path::PathBuf;

fn reference_page_path(page_file_name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../docs/wiki/reference")
        .join(page_file_name)
}

/// Fails when the committed page differs from a fresh render, or rewrites it when asked.
fn check_reference_page(page_file_name: &str, rendered_page: &str) {
    let page_path = reference_page_path(page_file_name);
    if std::env::var("SENDMOCK_UPDATE_REFERENCE").as_deref() == Ok("1") {
        fs::write(&page_path, rendered_page).expect("the reference page is writable");
        return;
    }
    // A Windows checkout may turn the committed page's line endings into CRLF.
    let committed_page = fs::read_to_string(&page_path)
        .unwrap_or_default()
        .replace("\r\n", "\n");
    assert!(
        committed_page == rendered_page,
        "docs/wiki/reference/{page_file_name} is out of date: run \
         `SENDMOCK_UPDATE_REFERENCE=1 cargo test -p sendmock reference_pages` and commit it"
    );
}

/// The front matter and the opening line every reference page shares.
fn render_page_header(title: &str, description: &str) -> String {
    format!(
        "---\ntitle: {title}\ndescription: {description}\n---\n\n\
         > Generated from SendMock's code, so it always matches the binary.\n\n"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configuration_flags_page_matches_the_serve_flags() {
        check_reference_page(
            "configuration-flags.md",
            &configuration_flags_page::render_configuration_flags_page(),
        );
    }

    #[test]
    fn magic_numbers_page_matches_the_simulation() {
        check_reference_page(
            "magic-numbers.md",
            &magic_numbers_page::render_magic_numbers_page(),
        );
    }

    #[test]
    fn template_filters_page_matches_the_filter_catalogue() {
        check_reference_page(
            "template-filters.md",
            &template_filters_page::render_template_filters_page(),
        );
    }

    #[test]
    fn webhook_templates_page_matches_the_template_catalogue() {
        check_reference_page(
            "webhook-templates.md",
            &webhook_templates_page::render_webhook_templates_page(),
        );
    }
}
