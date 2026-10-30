use super::EmailOutcome;

const SES_SIMULATOR_DOMAIN: &str = "simulator.amazonses.com";

/// Local parts that decide the outcome on any domain, SendMock's aliases.
const ANY_DOMAIN_ALIASES: [(&str, EmailOutcome); 5] = [
    ("delivered", EmailOutcome::Delivered),
    ("bounce", EmailOutcome::HardBounce),
    ("bounce+hard", EmailOutcome::HardBounce),
    ("bounce+soft", EmailOutcome::SoftBounce),
    ("complaint", EmailOutcome::Complaint),
];

/// The Amazon SES mailbox simulator, only on its own domain.
const SES_SIMULATOR_ADDRESSES: [(&str, EmailOutcome); 5] = [
    ("success", EmailOutcome::Delivered),
    ("bounce", EmailOutcome::HardBounce),
    ("complaint", EmailOutcome::Complaint),
    ("ooto", EmailOutcome::OutOfOffice),
    ("suppressionlist", EmailOutcome::SuppressionList),
];

/// The outcome a magic recipient address asks for; addresses compare without case.
pub fn find_magic_address_outcome(recipient_address: &str) -> Option<EmailOutcome> {
    let lowercase_address = recipient_address.trim().to_lowercase();
    let (local_part, domain) = lowercase_address.rsplit_once('@')?;
    if domain == SES_SIMULATOR_DOMAIN {
        return find_by_local_part(&SES_SIMULATOR_ADDRESSES, local_part);
    }
    find_by_local_part(&ANY_DOMAIN_ALIASES, local_part)
}

fn find_by_local_part(
    magic_addresses: &[(&str, EmailOutcome)],
    local_part: &str,
) -> Option<EmailOutcome> {
    magic_addresses
        .iter()
        .find(|(magic_local_part, _)| *magic_local_part == local_part)
        .map(|(_, email_outcome)| *email_outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ses_simulator_addresses_have_their_documented_outcomes() {
        let outcomes: Vec<Option<EmailOutcome>> = [
            "success@simulator.amazonses.com",
            "bounce@simulator.amazonses.com",
            "complaint@simulator.amazonses.com",
            "ooto@simulator.amazonses.com",
            "SuppressionList@Simulator.AmazonSES.com",
        ]
        .iter()
        .map(|address| find_magic_address_outcome(address))
        .collect();

        assert_eq!(
            outcomes,
            vec![
                Some(EmailOutcome::Delivered),
                Some(EmailOutcome::HardBounce),
                Some(EmailOutcome::Complaint),
                Some(EmailOutcome::OutOfOffice),
                Some(EmailOutcome::SuppressionList),
            ]
        );
    }

    #[test]
    fn sendmock_aliases_work_on_any_domain() {
        assert_eq!(
            find_magic_address_outcome("bounce+soft@shop.test"),
            Some(EmailOutcome::SoftBounce)
        );
        assert_eq!(
            find_magic_address_outcome("delivered@example.org"),
            Some(EmailOutcome::Delivered)
        );
        assert_eq!(
            find_magic_address_outcome("bounce+hard@qa.test"),
            Some(EmailOutcome::HardBounce)
        );
    }

    #[test]
    fn ses_only_addresses_and_ordinary_ones_are_not_magic_elsewhere() {
        assert_eq!(find_magic_address_outcome("ooto@shop.test"), None);
        assert_eq!(find_magic_address_outcome("sam@shop.test"), None);
        assert_eq!(find_magic_address_outcome("not-an-address"), None);
    }
}
