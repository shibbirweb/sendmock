/// A fast zstd level: emails compress several times over at it, and ingest stays quick.
const COMPRESSION_LEVEL: i32 = 3;

pub fn compress_raw_message(raw_message: &[u8]) -> std::io::Result<Vec<u8>> {
    zstd::encode_all(raw_message, COMPRESSION_LEVEL)
}

pub fn decompress_raw_message(compressed_raw_message: &[u8]) -> std::io::Result<Vec<u8>> {
    zstd::decode_all(compressed_raw_message)
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-03.1
    #[test]
    fn decompresses_to_the_exact_bytes_it_was_given() -> std::io::Result<()> {
        let raw_message =
            b"From: a@b.test\r\nSubject: \xe0\xa6\x86\r\n\r\nbody with trailing space \r\n"
                .repeat(20);

        let compressed = compress_raw_message(&raw_message)?;

        assert!(compressed.len() < raw_message.len());
        assert_eq!(decompress_raw_message(&compressed)?, raw_message);
        Ok(())
    }
}
