use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::Row;

// El agente mantiene su propio SQLite local con el inventario de
// archivos (para backups incrementales), el historial de ejecuciones
// y sus logs. Es independiente de la base de datos de la Web App
// (Postgres) -- esta es la "memoria" del propio motor de backup.

pub async fn init_pool() -> anyhow::Result<SqlitePool> {
    let db_path = std::env::var("AGENT_DB_PATH").unwrap_or_else(|_| "./agent.db".to_string());
    let url = format!("sqlite://{db_path}?mode=rwc");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS agent_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(&pool)
    .await?;

    // Ultimo hash conocido de cada archivo, por plan. Es lo que permite
    // los backups incrementales: si el hash no cambio, no se copia.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS agent_files (
            plan_id TEXT NOT NULL,
            path TEXT NOT NULL,
            hash TEXT NOT NULL,
            size INTEGER NOT NULL,
            modified_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (plan_id, path)
        )",
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS agent_executions (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            files_total INTEGER NOT NULL DEFAULT 0,
            files_done INTEGER NOT NULL DEFAULT 0,
            bytes_total INTEGER NOT NULL DEFAULT 0,
            error_message TEXT
        )",
    )
    .execute(&pool)
    .await?;

    // Marca por archivo dentro de una ejecucion concreta: permite
    // reanudar (si el proceso se corta, al reintentar la misma
    // execution_id se saltan los que ya estaban en "done"), y ademas
    // guarda hash/tamano para poder reportar el manifiesto completo
    // de la ejecucion (Fase 7: Historial).
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS agent_execution_files (
            execution_id TEXT NOT NULL,
            path TEXT NOT NULL,
            status TEXT NOT NULL,
            hash TEXT,
            size INTEGER,
            PRIMARY KEY (execution_id, path)
        )",
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS agent_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            execution_id TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}

pub async fn log(pool: &SqlitePool, execution_id: &str, level: &str, message: &str) {
    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query(
        "INSERT INTO agent_logs (execution_id, level, message, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(execution_id)
    .bind(level)
    .bind(message)
    .bind(&now)
    .execute(pool)
    .await;

    if let Err(err) = result {
        tracing::warn!("No se pudo guardar el log: {err}");
    }

    // Tambien a la consola: util al mirar los logs del proceso en vivo.
    tracing::info!(execution_id, level, "{message}");
}

pub async fn get_execution_files(
    pool: &SqlitePool,
    execution_id: &str,
) -> anyhow::Result<Vec<(String, Option<String>, Option<i64>)>> {
    let rows = sqlx::query(
        "SELECT path, hash, size FROM agent_execution_files WHERE execution_id = ? AND status = 'done' ORDER BY path ASC",
    )
    .bind(execution_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            (
                row.get::<String, _>("path"),
                row.get::<Option<String>, _>("hash"),
                row.get::<Option<i64>, _>("size"),
            )
        })
        .collect())
}

pub async fn get_logs(
    pool: &SqlitePool,
    execution_id: &str,
) -> anyhow::Result<Vec<(String, String, String)>> {
    let rows = sqlx::query(
        "SELECT level, message, created_at FROM agent_logs WHERE execution_id = ? ORDER BY id ASC",
    )
    .bind(execution_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            (
                row.get::<String, _>("level"),
                row.get::<String, _>("message"),
                row.get::<String, _>("created_at"),
            )
        })
        .collect())
}
