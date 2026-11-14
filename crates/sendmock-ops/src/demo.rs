//! `sendmock --demo`: the website demo's sample data loaded into a fresh instance (PL-09).

mod demo_data_loader;

pub use demo_data_loader::{DemoDataError, DemoLoadOutcome, load_demo_data};
