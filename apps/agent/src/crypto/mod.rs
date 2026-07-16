use sha2::{Digest, Sha256};

/// Calcula el hash SHA-256 de un bloque de bytes.
/// Fase 6: se usara para verificacion de integridad de cada archivo
/// respaldado y para detectar cambios en backups incrementales.
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

// Fase 6: funciones de cifrado/descifrado AES-256-GCM para los
// archivos comprimidos antes de escribirlos en el destino.
pub mod aes {
    // placeholder: implementacion completa en Fase 6
}
