// Fase 6: implementar deteccion de cambios usando `notify` para vigilar
// el sistema de archivos, combinado con hashing SHA-256 para backups
// incrementales fiables incluso si el watcher se pierde algun evento.

pub struct ScanResult {
    pub changed_files: Vec<String>,
}

pub fn scan_placeholder() -> ScanResult {
    ScanResult {
        changed_files: Vec::new(),
    }
}
