use sendmock_core::template::{BUILTIN_FILTER_NAMES, TEMPLATE_FILTER_CATALOGUE};

use super::markdown_table::{code, render_markdown_table};
use super::render_page_header;

pub fn render_template_filters_page() -> String {
    let mut page = render_page_header(
        "Template filters",
        "Every filter you can use in webhook templates, provider definitions and gateway templates.",
    );
    page.push_str(
        "Templates use Jinja syntax: `{{ data.subject | truncate(20) }}` passes the value \
         through a filter, and filters chain from left to right. See \
         [Templates](../advanced/templates.md) and [Variables](../advanced/variables.md) for \
         what a template can read.\n\n",
    );
    page.push_str("## SendMock's filters\n\n");
    let rows: Vec<Vec<String>> = TEMPLATE_FILTER_CATALOGUE
        .iter()
        .map(|filter_entry| {
            vec![
                code(filter_entry.name),
                code(filter_entry.usage),
                filter_entry.description.to_owned(),
            ]
        })
        .collect();
    page.push_str(&render_markdown_table(
        &["Filter", "Usage", "What it gives"],
        &rows,
    ));
    page.push_str("\n## Jinja's built-in filters\n\n");
    page.push_str(
        "These come from the template engine, [minijinja](https://docs.rs/minijinja/latest/minijinja/filters/index.html), \
         and work as they do in Jinja: ",
    );
    let builtin_names: Vec<String> = BUILTIN_FILTER_NAMES.iter().map(|name| code(name)).collect();
    page.push_str(&builtin_names.join(", "));
    page.push_str(".\n");
    page
}
