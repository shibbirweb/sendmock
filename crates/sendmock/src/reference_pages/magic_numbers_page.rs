use sendmock_mail::{describe_magic_outcome, list_magic_addresses};
use sendmock_sms::{MagicNumber, list_magic_number_groups};

use super::markdown_table::{code, render_markdown_table};
use super::render_page_header;

pub fn render_magic_numbers_page() -> String {
    let mut page = render_page_header(
        "Magic numbers and addresses",
        "The test phone numbers and email addresses that make SendMock simulate a delivery outcome.",
    );
    page.push_str(
        "Send to one of these and SendMock answers as the real service would for that outcome, \
         with no setup. They are on by default and can be turned off in Settings; your own rules \
         are described in [Custom outcome numbers](../advanced/sms-outcome-numbers.md) and \
         [Custom outcome addresses](../advanced/email-outcome-addresses.md).\n\n",
    );
    page.push_str("## SMS magic numbers\n\n");
    page.push_str(
        "The Twilio numbers and error codes are Twilio's official test numbers, so the same \
         tests pass against Twilio's test credentials. A `whatsapp:` prefix is ignored.\n\n",
    );
    for magic_number_group in list_magic_number_groups() {
        page.push_str(&format!("### {}\n\n", magic_number_group.title));
        let rows: Vec<Vec<String>> = magic_number_group
            .magic_numbers
            .iter()
            .map(describe_magic_number)
            .collect();
        page.push_str(&render_markdown_table(
            &["Number", "What happens", "Error code"],
            &rows,
        ));
        page.push('\n');
    }
    page.push_str("## Email magic addresses\n\n");
    page.push_str(
        "Addresses compare without case. The Amazon SES mailbox simulator addresses work only \
         on their own domain.\n\n",
    );
    let address_rows: Vec<Vec<String>> = list_magic_addresses()
        .into_iter()
        .map(|magic_address| {
            vec![
                code(&magic_address.address),
                describe_magic_outcome(magic_address.outcome).to_owned(),
            ]
        })
        .collect();
    page.push_str(&render_markdown_table(
        &["Address", "What happens"],
        &address_rows,
    ));
    page
}

fn describe_magic_number(magic_number: &MagicNumber) -> Vec<String> {
    vec![
        code(magic_number.number),
        magic_number.description.to_owned(),
        magic_number.error_code.map(code).unwrap_or_default(),
    ]
}
