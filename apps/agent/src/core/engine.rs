// Fase 6: motor principal. Debera soportar:
// incremental, versionado, verificacion de integridad (SHA-256),
// cancelacion/reanudacion, compresion opcional y encriptacion AES-256.

pub enum ExecutionStatus {
    Pending,
    Running,
    Success,
    Failed,
    Cancelled,
}

pub struct BackupExecution {
    pub id: String,
    pub status: ExecutionStatus,
}
