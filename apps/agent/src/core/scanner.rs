use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct ScannedFile {
    pub absolute_path: PathBuf,
    /// Ruta relativa a la carpeta de origen (para reconstruirla en el destino).
    pub relative_path: String,
    pub size: u64,
    pub modified_at: String, // RFC3339
    pub hash: String,
}

/// Recorre recursivamente `root`, aplicando `exclude_filters` (coincidencia
/// simple por nombre de carpeta/archivo o sufijo, no son globs completos)
/// y calculando el hash SHA-256 de cada archivo encontrado.
pub fn scan(root: &Path, exclude_filters: &[String]) -> anyhow::Result<Vec<ScannedFile>> {
    let mut results = Vec::new();
    if root.is_dir() {
        walk(root, root, exclude_filters, &mut results)?;
    } else if root.is_file() {
        if let Some(file) = scan_file(root, root)? {
            results.push(file);
        }
    }
    Ok(results)
}

fn walk(
    root: &Path,
    dir: &Path,
    exclude_filters: &[String],
    out: &mut Vec<ScannedFile>,
) -> anyhow::Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) => {
            tracing::warn!("No se pudo leer {:?}: {}", dir, err);
            return Ok(());
        }
    };

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if is_excluded(&name, exclude_filters) {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            walk(root, &path, exclude_filters, out)?;
        } else if metadata.is_file() {
            if let Some(file) = scan_file(root, &path)? {
                out.push(file);
            }
        }
    }

    Ok(())
}

fn scan_file(root: &Path, path: &Path) -> anyhow::Result<Option<ScannedFile>> {
    let hash = match hash_file_streaming(path) {
        Ok(hash) => hash,
        Err(err) => {
            tracing::warn!("No se pudo leer {:?}: {}", path, err);
            return Ok(None);
        }
    };

    let metadata = fs::metadata(path)?;
    let modified_at = metadata
        .modified()
        .map(|t| {
            let datetime: chrono::DateTime<chrono::Utc> = t.into();
            datetime.to_rfc3339()
        })
        .unwrap_or_else(|_| chrono::Utc::now().to_rfc3339());

    let relative_path = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");

    Ok(Some(ScannedFile {
        absolute_path: path.to_path_buf(),
        relative_path: if relative_path.is_empty() {
            path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default()
        } else {
            relative_path
        },
        size: metadata.len(),
        modified_at,
        hash,
    }))
}

/// Hashea el archivo leyendolo en bloques de 1MB, en vez de cargarlo
/// entero en memoria (importante para videos u otros archivos grandes).
fn hash_file_streaming(path: &Path) -> anyhow::Result<String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;

    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Coincidencia simple: nombre exacto, o el filtro empieza con "*" y el
/// nombre termina con ese sufijo (soporta el caso "*.tmp").
fn is_excluded(name: &str, filters: &[String]) -> bool {
    filters.iter().any(|filter| {
        if let Some(suffix) = filter.strip_prefix('*') {
            name.ends_with(suffix)
        } else {
            name == filter
        }
    })
}
