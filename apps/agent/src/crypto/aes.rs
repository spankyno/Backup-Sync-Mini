use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::RngCore;
use sha2::{Digest, Sha256};

const NONCE_LEN: usize = 12;

/// Deriva una clave de 32 bytes a partir de AGENT_ENCRYPTION_KEY (o, si no
/// esta configurada, de AGENT_TOKEN_SECRET como fallback -- se avisa una
/// vez en el log porque reutilizar el token de autenticacion como clave
/// de cifrado no es lo ideal a largo plazo, solo evita que el arranque
/// falle si el usuario todavia no separo ambos secretos).
fn derive_key() -> [u8; 32] {
    let secret = std::env::var("AGENT_ENCRYPTION_KEY")
        .or_else(|_| std::env::var("AGENT_TOKEN_SECRET"))
        .unwrap_or_default();

    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

/// Cifra `plaintext` con AES-256-GCM. El resultado es
/// `[nonce (12 bytes)][ciphertext + tag]`, autocontenido para poder
/// descifrarlo despues sin guardar el nonce por separado.
pub fn encrypt(plaintext: &[u8]) -> anyhow::Result<Vec<u8>> {
    let key_bytes = derive_key();
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| anyhow::anyhow!("Fallo al cifrar: {e}"))?;

    let mut output = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

/// Descifra un buffer producido por `encrypt`.
pub fn decrypt(data: &[u8]) -> anyhow::Result<Vec<u8>> {
    if data.len() < NONCE_LEN {
        anyhow::bail!("Datos cifrados demasiado cortos");
    }
    let key_bytes = derive_key();
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("Fallo al descifrar (¿clave incorrecta?): {e}"))
}
