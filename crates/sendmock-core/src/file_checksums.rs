//! The checksums mail tools show for a file, as lowercase hex.

use md5::Md5;
use sha1::Sha1;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileChecksums {
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
}

fn write_hex(digest_bytes: &[u8]) -> String {
    digest_bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn compute_file_checksums(file_bytes: &[u8]) -> FileChecksums {
    FileChecksums {
        md5: write_hex(&Md5::digest(file_bytes)),
        sha1: write_hex(&Sha1::digest(file_bytes)),
        sha256: write_hex(&Sha256::digest(file_bytes)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_checksums_of_a_known_text_match_the_published_values() {
        let checksums = compute_file_checksums(b"abc");

        assert_eq!(checksums.md5, "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(checksums.sha1, "a9993e364706816aba3e25717850c26c9cd0d89d");
        assert_eq!(
            checksums.sha256,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
