use sha2::{Digest, Sha256};

/// Calcula el hash SHA-256 de un bloque de bytes ya en memoria.
/// Para archivos grandes, ver `core::scanner::hash_file_streaming`,
/// que evita cargar el archivo entero en RAM.
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

pub mod aes;
pub mod compress;
