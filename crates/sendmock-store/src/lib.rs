//! SQLite storage: connection setup, migrations and repositories, with queries only and no business rules.

mod database;
mod database_location;
mod migration;
mod store_error;

pub use database::Database;
pub use database_location::DatabaseLocation;
pub use migration::{EMBEDDED_MIGRATIONS, Migration};
pub use store_error::StoreError;
