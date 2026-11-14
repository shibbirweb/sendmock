mod sequential_id_generator;
mod system_id_generator;

pub use sequential_id_generator::SequentialIdGenerator;
pub use system_id_generator::SystemIdGenerator;
pub use ulid::Ulid;

/// Creates the sortable ids every stored record uses.
pub trait IdGenerator: Send + Sync {
    fn generate_id(&self) -> Ulid;
}
