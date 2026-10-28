use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};
use std::time::Instant;

use sendmock_core::{Clock, SystemIdGenerator};
use sendmock_mail::{
    EmailEnvelope, EmailIngestService, IncomingEmail, IngestOptions, decompress_raw_message,
};
use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, EmailListFilter, EmailRepository,
};

/// A clock tests move forward by hand.
struct SteppingClock {
    now_unix_ms: AtomicI64,
}

impl Clock for SteppingClock {
    fn now_unix_ms(&self) -> i64 {
        self.now_unix_ms.load(Ordering::Relaxed)
    }
}

impl SteppingClock {
    fn advance_by_ms(&self, step_ms: i64) {
        self.now_unix_ms.fetch_add(step_ms, Ordering::Relaxed);
    }
}

struct IngestFixture {
    email_repository: EmailRepository,
    ingest_service: EmailIngestService,
    clock: Arc<SteppingClock>,
}

fn build_fixture() -> IngestFixture {
    let database = Arc::new(
        Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
            .unwrap_or_else(|open_error| panic!("an in-memory database: {open_error}")),
    );
    let email_repository = EmailRepository::new(database);
    let clock = Arc::new(SteppingClock {
        now_unix_ms: AtomicI64::new(1_767_225_600_000),
    });
    let ingest_service = EmailIngestService::new(
        email_repository.clone(),
        clock.clone(),
        Arc::new(SystemIdGenerator),
    );
    IngestFixture {
        email_repository,
        ingest_service,
        clock,
    }
}

fn message(from: &str, to: &str, subject: &str, body: &str) -> Vec<u8> {
    format!("From: {from}\r\nTo: {to}\r\nSubject: {subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{body}\r\n").into_bytes()
}

async fn ingest(fixture: &IngestFixture, raw_message: Vec<u8>, recipients: &[&str]) -> String {
    let envelope = EmailEnvelope {
        mail_from: "app@shop.test".to_owned(),
        recipients: recipients
            .iter()
            .map(|recipient| (*recipient).to_owned())
            .collect(),
    };
    fixture
        .ingest_service
        .ingest(
            IncomingEmail::sent_by_app(raw_message, envelope, "smtp"),
            &IngestOptions::default(),
        )
        .await
        .unwrap_or_else(|ingest_error| panic!("the email is stored: {ingest_error}"))
        .email_id
}

// AC: EM-01.4
#[tokio::test]
async fn stores_one_email_with_every_envelope_recipient_and_marks_hidden_ones_as_bcc() {
    let fixture = build_fixture();
    let raw_message = message(
        "Shop <no-reply@shop.test>",
        "sam@example.test",
        "Welcome",
        "Hello",
    );

    let email_id = ingest(
        &fixture,
        raw_message,
        &["sam@example.test", "audit@shop.test"],
    )
    .await;

    let email = fixture
        .email_repository
        .find_email(&email_id)
        .await
        .unwrap_or_else(|error| panic!("a read: {error:?}"))
        .unwrap_or_else(|| panic!("the email is missing"));
    assert_eq!(email.envelope_to, ["sam@example.test", "audit@shop.test"]);
    assert_eq!(email.bcc.len(), 1);
    assert_eq!(email.bcc[0].address, "audit@shop.test");
}

#[tokio::test]
async fn extracts_codes_links_and_tags_on_arrival() {
    let fixture = build_fixture();
    let raw_message = "From: no-reply@shop.test\r\nTo: user+signup@example.test\r\nX-Tags: welcome\r\nSubject: Confirm\r\n\r\nYour code is 482913. Confirm at https://shop.test/confirm?t=1\r\n".to_owned();

    let email_id = ingest(
        &fixture,
        raw_message.into_bytes(),
        &["user+signup@example.test"],
    )
    .await;

    let email = fixture
        .email_repository
        .find_email(&email_id)
        .await
        .unwrap_or_else(|error| panic!("a read: {error:?}"))
        .unwrap_or_else(|| panic!("the email is missing"));
    assert_eq!(email.otp_codes, ["482913"]);
    assert_eq!(email.links, ["https://shop.test/confirm?t=1"]);
    assert_eq!(email.tags, ["welcome", "signup"]);
    assert_eq!(
        email.snippet,
        "Your code is 482913. Confirm at https://shop.test/confirm?t=1"
    );
}

// AC: EM-03.1
#[tokio::test]
async fn keeps_the_raw_message_byte_for_byte() {
    let fixture = build_fixture();
    let raw_message =
        b"From: a@b.test\r\nTo: c@d.test\r\nSubject: bytes\r\n\r\n\xe0\xa6\x86 trailing \r\n\r\n"
            .to_vec();

    let email_id = ingest(&fixture, raw_message.clone(), &["c@d.test"]).await;

    let compressed = fixture
        .email_repository
        .read_compressed_raw_message(&email_id)
        .await
        .unwrap_or_else(|error| panic!("a read: {error:?}"))
        .unwrap_or_else(|| panic!("the raw message is missing"));
    assert_eq!(
        decompress_raw_message(&compressed)
            .unwrap_or_else(|error| panic!("it decompresses: {error:?}")),
        raw_message
    );
}

async fn count_matching(fixture: &IngestFixture, filter: EmailListFilter) -> u64 {
    fixture
        .email_repository
        .list_emails(filter, None, 50)
        .await
        .unwrap_or_else(|error| panic!("a list: {error:?}"))
        .total_count
}

fn filter_where(set_condition: impl FnOnce(&mut EmailListFilter)) -> EmailListFilter {
    let mut filter = EmailListFilter::default();
    set_condition(&mut filter);
    filter
}

fn text(value: &str) -> Option<String> {
    Some(value.to_owned())
}

/// A read, tagged password reset from a bank and an unread newsletter from a shop.
async fn store_bank_and_shop_emails(fixture: &IngestFixture) {
    let reset_id = ingest(
        fixture,
        message(
            "security@bank.test",
            "sam@example.test",
            "Reset your password",
            "Use the link",
        ),
        &["sam@example.test"],
    )
    .await;
    ingest(
        fixture,
        message(
            "news@shop.test",
            "ann@example.test",
            "Weekly deals",
            "Discounts inside",
        ),
        &["ann@example.test"],
    )
    .await;
    fixture
        .email_repository
        .update_read_and_tags(&reset_id, Some(true), Some(vec!["qa".to_owned()]))
        .await
        .unwrap_or_else(|error| panic!("an update: {error:?}"));
}

// AC: EM-03.4
#[tokio::test]
async fn filters_by_sender_recipient_subject_tag_attachment_read_state_and_text() {
    let fixture = build_fixture();
    store_bank_and_shop_emails(&fixture).await;
    let expected_counts = [
        (
            filter_where(|filter| filter.from_contains = text("bank")),
            1,
        ),
        (filter_where(|filter| filter.to_contains = text("ann@")), 1),
        (
            filter_where(|filter| filter.subject_contains = text("reset")),
            1,
        ),
        (filter_where(|filter| filter.tag = text("qa")), 1),
        (filter_where(|filter| filter.is_unread = Some(true)), 1),
        (filter_where(|filter| filter.has_attachment = Some(true)), 0),
        (filter_where(|filter| filter.source = text("smtp")), 2),
        (filter_where(|filter| filter.search_text = text("disc")), 1),
    ];

    for (filter, expected_count) in expected_counts {
        assert_eq!(
            count_matching(&fixture, filter.clone()).await,
            expected_count,
            "{filter:?}"
        );
    }
}

// AC: PL-01.2
#[tokio::test]
async fn pages_newest_first_with_a_cursor() {
    let fixture = build_fixture();
    for message_number in 1..=5 {
        ingest(
            &fixture,
            message(
                "a@b.test",
                "c@d.test",
                &format!("Message {message_number}"),
                "x",
            ),
            &["c@d.test"],
        )
        .await;
    }

    let first_page = fixture
        .email_repository
        .list_emails(EmailListFilter::default(), None, 2)
        .await
        .unwrap_or_else(|error| panic!("a page: {error:?}"));
    let second_page = fixture
        .email_repository
        .list_emails(
            EmailListFilter::default(),
            first_page.next_cursor.clone(),
            2,
        )
        .await
        .unwrap_or_else(|error| panic!("a page: {error:?}"));

    assert_eq!(first_page.total_count, 5);
    assert_eq!(first_page.emails[0].subject, "Message 5");
    assert_eq!(second_page.emails[0].subject, "Message 3");
    assert!(first_page.next_cursor.is_some());
}

// AC: EM-03.2
#[tokio::test]
async fn prunes_the_oldest_beyond_the_count_and_everything_older_than_the_cut_off() {
    let fixture = build_fixture();
    for message_number in 1..=5 {
        ingest(
            &fixture,
            message(
                "a@b.test",
                "c@d.test",
                &format!("Message {message_number}"),
                "x",
            ),
            &["c@d.test"],
        )
        .await;
        fixture.clock.advance_by_ms(1000);
    }

    let deleted_by_count = fixture
        .email_repository
        .prune_emails(Some(3), None)
        .await
        .unwrap_or_else(|error| panic!("a prune: {error:?}"));
    let deleted_by_age = fixture
        .email_repository
        .prune_emails(None, Some(1_767_225_600_000 + 4000))
        .await
        .unwrap_or_else(|error| panic!("a prune: {error:?}"));

    let remaining = fixture
        .email_repository
        .list_emails(EmailListFilter::default(), None, 50)
        .await
        .unwrap_or_else(|error| panic!("a list: {error:?}"));
    assert_eq!(deleted_by_count, 2);
    assert_eq!(deleted_by_age, 2);
    assert_eq!(
        remaining
            .emails
            .iter()
            .map(|email| email.subject.as_str())
            .collect::<Vec<_>>(),
        ["Message 5"]
    );
}

/// Stores copies of an email straight through the repository, skipping parsing, so the
/// search test is about search speed only. The copy at `password_position` is about a password.
async fn store_copies(
    fixture: &IngestFixture,
    template_id: &str,
    copy_count: u32,
    password_position: u32,
) {
    let template_email = fixture
        .email_repository
        .find_email(template_id)
        .await
        .unwrap_or_else(|error| panic!("a read: {error:?}"))
        .unwrap_or_else(|| panic!("the email is missing"));
    let compressed_raw_message = fixture
        .email_repository
        .read_compressed_raw_message(template_id)
        .await
        .unwrap_or_else(|error| panic!("a read: {error:?}"))
        .unwrap_or_else(|| panic!("the raw message is missing"));
    for copy_position in 0..copy_count {
        let mut stored_copy = template_email.clone();
        stored_copy.email_id =
            sendmock_core::IdGenerator::generate_id(&SystemIdGenerator).to_string();
        stored_copy.subject = if copy_position == password_position {
            "Reset your password".to_owned()
        } else {
            format!("Order {copy_position} update")
        };
        let new_email = sendmock_store::NewEmailRecord {
            email: stored_copy,
            compressed_raw_message: compressed_raw_message.clone(),
            attachments: Vec::new(),
        };
        fixture
            .email_repository
            .insert_email(new_email)
            .await
            .unwrap_or_else(|error| panic!("the copy is stored: {error:?}"));
    }
}

// AC: EM-03.4
#[tokio::test]
async fn searches_ten_thousand_emails_in_under_200_ms() {
    let fixture = build_fixture();
    let template_id = ingest(
        &fixture,
        message(
            "shop@shop.test",
            "user@example.test",
            "Order update",
            "Order shipped",
        ),
        &["user@example.test"],
    )
    .await;
    store_copies(&fixture, &template_id, 9_999, 7_777).await;
    let password_filter = EmailListFilter {
        search_text: text("password"),
        ..EmailListFilter::default()
    };

    let search_started = Instant::now();
    let page = fixture
        .email_repository
        .list_emails(password_filter, None, 50)
        .await
        .unwrap_or_else(|error| panic!("a search: {error:?}"));
    let search_duration = search_started.elapsed();

    assert_eq!(page.total_count, 1);
    assert!(
        search_duration.as_millis() < 200,
        "the search took {search_duration:?}"
    );
}
