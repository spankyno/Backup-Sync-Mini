use crate::core::scanner::{self, ScannedFile};
use crate::crypto::{aes, compress};
use crate::storage::db;
use serde::Serialize;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::{Path, PathBuf};
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Serialize)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Success,
    Failed,
    Cancelled,
}

impl ExecutionStatus {
    fn as_str(&self) -> &'static str {
        match self {
            ExecutionStatus::Pending => "PENDING",
            ExecutionStatus::Running => "RUNNING",
            ExecutionStatus::Success => "SUCCESS",
            ExecutionStatus::Failed => "FAILED",
            ExecutionStatus::Cancelled => "CANCELLED",
        }
    }
}

#[derive(Debug, Clone)]
pub struct BackupParams {
    pub execution_id: String,
    pub plan_id: String,
    pub sources: Vec<String>,
    pub destination_path: String,
    pub versioning_max: u32,
    pub compression: bool,
    pub encryption: bool,
    pub exclude_filters: Vec<String>,
}

/// Punto de entrada del motor de backup. Pensado para lanzarse en su
/// propia tarea de tokio (no bloquea el servidor HTTP mientras corre).
pub async fn run_backup(pool: SqlitePool, params: BackupParams, cancel: CancellationToken) {
    let execution_id = params.execution_id.clone();

    if let Err(err) = run_backup_inner(&pool, &params, &cancel).await {
        db::log(&pool, &execution_id, "error", &format!("Backup fallido: {err}")).await;
        mark_execution(
            &pool,
            &execution_id,
            ExecutionStatus::Failed,
            Some(err.to_string()),
        )
        .await;
    }
}

async fn run_backup_inner(
    pool: &SqlitePool,
    params: &BackupParams,
    cancel: &CancellationToken,
) -> anyhow::Result<()> {
    let BackupParams {
        execution_id,
        plan_id,
        sources,
        destination_path,
        versioning_max,
        compression,
        encryption,
        exclude_filters,
    } = params;

    upsert_execution_start(pool, execution_id, plan_id).await?;
    db::log(pool, execution_id, "info", "Iniciando backup").await;

    // 1. Escanear todas las carpetas de origen.
    let mut scanned: Vec<ScannedFile> = Vec::new();
    for source in sources {
        let root = PathBuf::from(source);
        let namespace = root
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "origen".to_string());

        match scanner::scan(&root, exclude_filters) {
            Ok(mut files) => {
                for file in &mut files {
                    file.relative_path = format!("{namespace}/{}", file.relative_path);
                }
                scanned.extend(files);
            }
            Err(err) => {
                db::log(
                    pool,
                    execution_id,
                    "warn",
                    &format!("No se pudo escanear {source}: {err}"),
                )
                .await;
            }
        }
    }

    db::log(
        pool,
        execution_id,
        "info",
        &format!("{} archivo(s) encontrados en origen", scanned.len()),
    )
    .await;

    // 2. Filtrar solo los que cambiaron desde el ultimo backup (incremental).
    let mut to_copy = Vec::new();
    for file in scanned {
        let previous_hash = get_last_hash(pool, plan_id, &file.absolute_path).await?;
        if previous_hash.as_deref() != Some(file.hash.as_str()) {
            to_copy.push(file);
        }
    }

    db::log(
        pool,
        execution_id,
        "info",
        &format!("{} archivo(s) cambiaron y se copiarán", to_copy.len()),
    )
    .await;

    set_files_total(pool, execution_id, to_copy.len() as i64).await?;

    // 3. Copiar cada archivo cambiado a la carpeta de esta version.
    let version_dir = Path::new(destination_path).join(plan_id).join(execution_id);
    std::fs::create_dir_all(&version_dir)?;

    let mut files_done: i64 = 0;
    let mut bytes_total: i64 = 0;

    for file in &to_copy {
        if cancel.is_cancelled() {
            db::log(pool, execution_id, "warn", "Backup cancelado por el usuario").await;
            mark_execution(pool, execution_id, ExecutionStatus::Cancelled, None).await;
            return Ok(());
        }

        // Reanudacion: si este archivo ya se copio en un intento anterior
        // de esta misma ejecucion, no se repite.
        if is_file_already_done(pool, execution_id, &file.relative_path).await? {
            files_done += 1;
            continue;
        }

        match copy_one_file(file, &version_dir, *compression, *encryption) {
            Ok(written_bytes) => {
                bytes_total += written_bytes as i64;
                upsert_file_hash(pool, plan_id, file).await?;
                mark_file_done(
                    pool,
                    execution_id,
                    &file.relative_path,
                    "done",
                    Some(&file.hash),
                    Some(file.size as i64),
                )
                .await?;
                files_done += 1;
                set_progress(pool, execution_id, files_done, bytes_total).await?;
            }
            Err(err) => {
                db::log(
                    pool,
                    execution_id,
                    "error",
                    &format!("Error copiando {}: {err}", file.relative_path),
                )
                .await;
                mark_file_done(pool, execution_id, &file.relative_path, "failed", None, None)
                    .await?;
            }
        }
    }

    // 4. Aplicar retencion (borrar versiones antiguas por encima del maximo).
    if let Err(err) = prune_old_versions(pool, plan_id, destination_path, *versioning_max).await {
        db::log(
            pool,
            execution_id,
            "warn",
            &format!("No se pudo aplicar la retención de versiones: {err}"),
        )
        .await;
    }

    db::log(pool, execution_id, "info", "Backup completado").await;
    mark_execution(pool, execution_id, ExecutionStatus::Success, None).await;

    Ok(())
}

/// Copia un archivo aplicando compresion/encriptacion opcionales, y
/// verifica el resultado deshaciendo el proceso y comparando el hash.
fn copy_one_file(
    file: &ScannedFile,
    version_dir: &Path,
    compression: bool,
    encryption: bool,
) -> anyhow::Result<u64> {
    let mut bytes = std::fs::read(&file.absolute_path)?;

    if compression {
        bytes = compress::compress(&bytes)?;
    }
    if encryption {
        bytes = aes::encrypt(&bytes)?;
    }

    let mut dest_name = file.relative_path.clone();
    if compression {
        dest_name.push_str(".gz");
    }
    if encryption {
        dest_name.push_str(".enc");
    }

    let dest_path = version_dir.join(&dest_name);
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&dest_path, &bytes)?;
    let written_len = bytes.len() as u64;

    // Verificacion: deshacer el proceso desde el archivo ya escrito en
    // disco (no desde el buffer en memoria) y comparar el hash contra
    // el original, para detectar corrupcion real de escritura.
    let mut verify_bytes = std::fs::read(&dest_path)?;
    if encryption {
        verify_bytes = aes::decrypt(&verify_bytes)?;
    }
    if compression {
        verify_bytes = compress::decompress(&verify_bytes)?;
    }
    let verify_hash = crate::crypto::sha256_hex(&verify_bytes);
    if verify_hash != file.hash {
        anyhow::bail!("Verificación de integridad falló para {}", file.relative_path);
    }

    Ok(written_len)
}

async fn prune_old_versions(
    pool: &SqlitePool,
    plan_id: &str,
    destination_path: &str,
    versioning_max: u32,
) -> anyhow::Result<()> {
    let rows = sqlx::query(
        "SELECT id FROM agent_executions WHERE plan_id = ? AND status = 'SUCCESS' ORDER BY started_at DESC",
    )
    .bind(plan_id)
    .fetch_all(pool)
    .await?;

    let ids: Vec<String> = rows.into_iter().map(|r| r.get::<String, _>("id")).collect();

    for old_id in ids.into_iter().skip(versioning_max as usize) {
        let version_dir = Path::new(destination_path).join(plan_id).join(&old_id);
        if version_dir.exists() {
            std::fs::remove_dir_all(&version_dir)?;
        }
    }

    Ok(())
}

// --- Helpers de persistencia en SQLite local ---

async fn upsert_execution_start(
    pool: &SqlitePool,
    execution_id: &str,
    plan_id: &str,
) -> anyhow::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO agent_executions (id, plan_id, status, started_at, files_total, files_done, bytes_total)
         VALUES (?, ?, 'RUNNING', ?, 0, 0, 0)
         ON CONFLICT(id) DO UPDATE SET status = 'RUNNING'",
    )
    .bind(execution_id)
    .bind(plan_id)
    .bind(&now)
    .execute(pool)
    .await?;
    Ok(())
}

async fn set_files_total(pool: &SqlitePool, execution_id: &str, total: i64) -> anyhow::Result<()> {
    sqlx::query("UPDATE agent_executions SET files_total = ? WHERE id = ?")
        .bind(total)
        .bind(execution_id)
        .execute(pool)
        .await?;
    Ok(())
}

async fn set_progress(
    pool: &SqlitePool,
    execution_id: &str,
    files_done: i64,
    bytes_total: i64,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE agent_executions SET files_done = ?, bytes_total = ? WHERE id = ?")
        .bind(files_done)
        .bind(bytes_total)
        .bind(execution_id)
        .execute(pool)
        .await?;
    Ok(())
}

async fn mark_execution(
    pool: &SqlitePool,
    execution_id: &str,
    status: ExecutionStatus,
    error_message: Option<String>,
) {
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "UPDATE agent_executions SET status = ?, finished_at = ?, error_message = ? WHERE id = ?",
    )
    .bind(status.as_str())
    .bind(&now)
    .bind(error_message)
    .bind(execution_id)
    .execute(pool)
    .await;

    if let Err(err) = result {
        tracing::error!("No se pudo actualizar el estado de la ejecución: {err}");
    }
}

async fn get_last_hash(
    pool: &SqlitePool,
    plan_id: &str,
    absolute_path: &Path,
) -> anyhow::Result<Option<String>> {
    let path_str = absolute_path.to_string_lossy().to_string();
    let row = sqlx::query("SELECT hash FROM agent_files WHERE plan_id = ? AND path = ?")
        .bind(plan_id)
        .bind(&path_str)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(|r| r.get::<String, _>("hash")))
}

async fn upsert_file_hash(
    pool: &SqlitePool,
    plan_id: &str,
    file: &ScannedFile,
) -> anyhow::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    let path_str = file.absolute_path.to_string_lossy().to_string();
    sqlx::query(
        "INSERT INTO agent_files (plan_id, path, hash, size, modified_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(plan_id, path) DO UPDATE SET
            hash = excluded.hash,
            size = excluded.size,
            modified_at = excluded.modified_at,
            updated_at = excluded.updated_at",
    )
    .bind(plan_id)
    .bind(&path_str)
    .bind(&file.hash)
    .bind(file.size as i64)
    .bind(&file.modified_at)
    .bind(&now)
    .execute(pool)
    .await?;
    Ok(())
}

async fn is_file_already_done(
    pool: &SqlitePool,
    execution_id: &str,
    relative_path: &str,
) -> anyhow::Result<bool> {
    let row = sqlx::query(
        "SELECT status FROM agent_execution_files WHERE execution_id = ? AND path = ?",
    )
    .bind(execution_id)
    .bind(relative_path)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| r.get::<String, _>("status")) == Some("done".to_string()))
}

async fn mark_file_done(
    pool: &SqlitePool,
    execution_id: &str,
    relative_path: &str,
    status: &str,
    hash: Option<&str>,
    size: Option<i64>,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO agent_execution_files (execution_id, path, status, hash, size) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(execution_id, path) DO UPDATE SET status = excluded.status, hash = excluded.hash, size = excluded.size",
    )
    .bind(execution_id)
    .bind(relative_path)
    .bind(status)
    .bind(hash)
    .bind(size)
    .execute(pool)
    .await?;
    Ok(())
}

/// Lee el estado actual de una ejecucion desde el SQLite local (lo usa
/// el handler HTTP GET /api/v1/backups/:id).
pub async fn get_execution_status(
    pool: &SqlitePool,
    execution_id: &str,
) -> anyhow::Result<Option<ExecutionRow>> {
    let row = sqlx::query(
        "SELECT id, plan_id, status, started_at, finished_at, files_total, files_done, bytes_total, error_message
         FROM agent_executions WHERE id = ?",
    )
    .bind(execution_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| ExecutionRow {
        id: r.get("id"),
        plan_id: r.get("plan_id"),
        status: r.get("status"),
        started_at: r.get("started_at"),
        finished_at: r.get("finished_at"),
        files_total: r.get("files_total"),
        files_done: r.get("files_done"),
        bytes_total: r.get("bytes_total"),
        error_message: r.get("error_message"),
    }))
}

#[derive(Debug, Serialize)]
pub struct ExecutionRow {
    pub id: String,
    pub plan_id: String,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub files_total: i64,
    pub files_done: i64,
    pub bytes_total: i64,
    pub error_message: Option<String>,
}
