pub fn checksum(bytes: &[u8]) -> u8 {
    bytes.iter().fold(0u8, |acc, b| acc.wrapping_add(*b))
}
