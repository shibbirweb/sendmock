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
];
