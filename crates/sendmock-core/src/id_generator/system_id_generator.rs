use super::{IdGenerator, Ulid};

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemIdGenerator;

impl IdGenerator for SystemIdGenerator {
    fn generate_id(&self) -> Ulid {
        Ulid::generate()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_a_different_id_each_time() {
        let first_id = SystemIdGenerator.generate_id();
        let second_id = SystemIdGenerator.generate_id();

        assert_ne!(first_id, second_id);
    }
}
