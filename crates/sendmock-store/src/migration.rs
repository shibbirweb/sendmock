mod migration_runner;

pub use migration_runner::apply_migrations;

/// One forward-only schema step, applied once and recorded in `PRAGMA user_version`.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    pub schema_version: u32,
    pub sql: &'static str,
}

pub const EMBEDDED_MIGRATIONS: &[Migration] = &[
    Migration {
        schema_version: 1,
        sql: include_str!("../migrations/0001_init.sql"),
    },
    Migration {
        schema_version: 2,
        sql: include_str!("../migrations/0002_email.sql"),
    },
    Migration {
        schema_version: 3,
        sql: include_str!("../migrations/0003_smtp_sessions.sql"),
    },
    Migration {
        schema_version: 4,
        sql: include_str!("../migrations/0004_api_requests.sql"),
    },
    Migration {
        schema_version: 5,
        sql: include_str!("../migrations/0005_sms.sql"),
    },
    Migration {
        schema_version: 6,
        sql: include_str!("../migrations/0006_sms_outcome_rules.sql"),
    },
    Migration {
        schema_version: 7,
        sql: include_str!("../migrations/0007_numbers.sql"),
    },
    Migration {
        schema_version: 8,
        sql: include_str!("../migrations/0008_verify.sql"),
    },
    Migration {
        schema_version: 9,
        sql: include_str!("../migrations/0009_message_providers.sql"),
    },
    Migration {
        schema_version: 10,
        sql: include_str!("../migrations/0010_webhook_endpoints.sql"),
    },
    Migration {
        schema_version: 11,
        sql: include_str!("../migrations/0011_webhook_deliveries.sql"),
    },
    Migration {
        schema_version: 12,
        sql: include_str!("../migrations/0012_webhook_rules.sql"),
    },
    Migration {
        schema_version: 13,
        sql: include_str!("../migrations/0013_webhook_variables.sql"),
    },
    Migration {
        schema_version: 14,
        sql: include_str!("../migrations/0014_webhook_templates.sql"),
    },
    Migration {
        schema_version: 15,
        sql: include_str!("../migrations/0015_detached_endpoint_templates.sql"),
    },
    Migration {
        schema_version: 16,
        sql: include_str!("../migrations/0016_webhook_delivery_events.sql"),
    },
    Migration {
        schema_version: 17,
        sql: include_str!("../migrations/0017_saved_webhook_deliveries.sql"),
    },
];
