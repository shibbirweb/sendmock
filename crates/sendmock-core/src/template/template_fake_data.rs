//! Fake people, companies, places and text for `fake.*()` and `lorem()`, drawn from small word
//! lists through a `RandomSource`, so a seeded source gives the same values in tests.

use super::template_random_values::random_index;
use crate::RandomSource;

const FIRST_NAMES: &[&str] = &[
    "Ava", "Liam", "Maya", "Noah", "Sara", "Omar", "Lena", "Ravi", "Nadia", "Karim", "Elena",
    "Tomas", "Aisha", "Jonas", "Mei", "Lucas", "Fatima", "Hugo", "Priya", "Samuel",
];
const LAST_NAMES: &[&str] = &[
    "Ahmed", "Novak", "Silva", "Kim", "Okafor", "Larsen", "Haddad", "Rossi", "Tanaka", "Moreau",
    "Islam", "Fischer", "Costa", "Walsh", "Patel", "Nguyen", "Berg", "Rahman",
];
const COMPANY_WORDS: &[&str] = &[
    "Acme",
    "Northwind",
    "Bluebird",
    "Summit",
    "Harbor",
    "Orchid",
    "Atlas",
    "Pioneer",
    "Lumen",
    "Cedar",
];
const COMPANY_SUFFIXES: &[&str] = &["Ltd", "Inc", "Group", "Labs", "and Co", "Studio"];
const CITIES: &[&str] = &[
    "Dhaka",
    "Lisbon",
    "Nairobi",
    "Oslo",
    "Austin",
    "Kyoto",
    "Lyon",
    "Toronto",
    "Chittagong",
    "Melbourne",
    "Porto",
    "Seoul",
];
const STREET_NAMES: &[&str] = &[
    "Lake Road",
    "Station Street",
    "Park Avenue",
    "Hill Lane",
    "River Way",
    "Market Street",
    "Garden Road",
    "Mill Lane",
];
const COUNTRY_CODES: &[&str] = &[
    "BD", "US", "GB", "DE", "FR", "IN", "JP", "BR", "KE", "CA", "AU", "NL",
];
const LOREM_WORDS: &[&str] = &[
    "lorem",
    "ipsum",
    "dolor",
    "sit",
    "amet",
    "consectetur",
    "adipiscing",
    "elit",
    "sed",
    "do",
    "eiusmod",
    "tempor",
    "incididunt",
    "ut",
    "labore",
    "et",
    "dolore",
    "magna",
    "aliqua",
    "enim",
    "minim",
    "veniam",
    "quis",
    "nostrud",
];
const USER_AGENTS: &[&str] = &[
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
];
/// Test domains only, so a fake address can never reach a real mailbox or site.
const EMAIL_DOMAINS: &[&str] = &["example.com", "example.org", "example.test"];

/// Every `fake.*` method, as `fake.<method>()` in templates.
pub const FAKE_METHOD_NAMES: &[&str] = &[
    "name",
    "first_name",
    "last_name",
    "email",
    "username",
    "company",
    "sentence",
    "paragraph",
    "word",
    "address",
    "city",
    "country_code",
    "ip",
    "user_agent",
    "url",
];

fn pick(random_source: &dyn RandomSource, items: &[&'static str]) -> &'static str {
    items[random_index(random_source, items.len())]
}

fn pick_number(random_source: &dyn RandomSource, below: usize) -> usize {
    random_index(random_source, below)
}

/// `count` lorem words separated by spaces.
pub fn generate_lorem(random_source: &dyn RandomSource, count: usize) -> String {
    (0..count)
        .map(|_| pick(random_source, LOREM_WORDS))
        .collect::<Vec<_>>()
        .join(" ")
}

fn generate_sentence(random_source: &dyn RandomSource) -> String {
    let words = generate_lorem(random_source, 6 + pick_number(random_source, 6));
    let mut characters = words.chars();
    let capitalized = characters
        .next()
        .map(|first| first.to_uppercase().chain(characters).collect::<String>())
        .unwrap_or_default();
    format!("{capitalized}.")
}

fn generate_username(random_source: &dyn RandomSource) -> String {
    format!(
        "{}.{}{}",
        pick(random_source, FIRST_NAMES).to_lowercase(),
        pick(random_source, LAST_NAMES).to_lowercase(),
        pick_number(random_source, 100)
    )
}

/// The value of `fake.<method_name>()`; `None` for a method that does not exist.
pub fn generate_fake_value(random_source: &dyn RandomSource, method_name: &str) -> Option<String> {
    let fake_value = match method_name {
        "name" => format!(
            "{} {}",
            pick(random_source, FIRST_NAMES),
            pick(random_source, LAST_NAMES)
        ),
        "first_name" => pick(random_source, FIRST_NAMES).to_owned(),
        "last_name" => pick(random_source, LAST_NAMES).to_owned(),
        "email" => format!(
            "{}@{}",
            generate_username(random_source),
            pick(random_source, EMAIL_DOMAINS)
        ),
        "username" => generate_username(random_source),
        "company" => format!(
            "{} {}",
            pick(random_source, COMPANY_WORDS),
            pick(random_source, COMPANY_SUFFIXES)
        ),
        "sentence" => generate_sentence(random_source),
        "paragraph" => (0..3 + pick_number(random_source, 3))
            .map(|_| generate_sentence(random_source))
            .collect::<Vec<_>>()
            .join(" "),
        "word" => pick(random_source, LOREM_WORDS).to_owned(),
        "address" => format!(
            "{} {}, {}",
            1 + pick_number(random_source, 250),
            pick(random_source, STREET_NAMES),
            pick(random_source, CITIES)
        ),
        "city" => pick(random_source, CITIES).to_owned(),
        "country_code" => pick(random_source, COUNTRY_CODES).to_owned(),
        // Documentation ranges (RFC 5737), never a routable host.
        "ip" => format!("203.0.113.{}", 1 + pick_number(random_source, 254)),
        "user_agent" => pick(random_source, USER_AGENTS).to_owned(),
        "url" => format!(
            "https://{}/{}",
            pick(random_source, EMAIL_DOMAINS),
            pick(random_source, LOREM_WORDS)
        ),
        _ => return None,
    };
    Some(fake_value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::SeededRandomSource;

    #[test]
    fn every_fake_method_answers_a_value_and_unknown_ones_none() {
        let random_source = SeededRandomSource::new(7);

        for method_name in FAKE_METHOD_NAMES {
            let fake_value = generate_fake_value(&random_source, method_name);
            assert!(
                fake_value.is_some_and(|value| !value.is_empty()),
                "fake.{method_name}()"
            );
        }
        assert_eq!(generate_fake_value(&random_source, "credit_card"), None);
    }

    #[test]
    fn fake_contact_details_never_point_at_real_hosts() {
        let random_source = SeededRandomSource::new(11);

        for _ in 0..20 {
            let email = generate_fake_value(&random_source, "email").unwrap_or_default();
            let ip = generate_fake_value(&random_source, "ip").unwrap_or_default();
            assert!(
                EMAIL_DOMAINS.iter().any(|domain| email.ends_with(domain)),
                "{email}"
            );
            assert!(ip.starts_with("203.0.113."), "{ip}");
        }
    }

    #[test]
    fn lorem_answers_the_number_of_words_asked_for() {
        let random_source = SeededRandomSource::new(3);

        assert_eq!(generate_lorem(&random_source, 5).split(' ').count(), 5);
    }

    #[test]
    fn a_seeded_source_gives_the_same_fake_values() {
        let first_source = SeededRandomSource::new(42);
        let second_source = SeededRandomSource::new(42);

        assert_eq!(
            generate_fake_value(&first_source, "name"),
            generate_fake_value(&second_source, "name")
        );
    }
}
