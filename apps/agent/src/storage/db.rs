use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

// El agente mantiene su propio SQLite local con el inventario de
// archivos, historial de ejecuciones y estado de sincronizacion.
// Es independiente de la base de datos de la Web App (Postgres).

pub async fn init_pool() -> anyhow::Result<SqlitePool> {
    let db_path = std::env::var("AGENT_DB_PATH").unwrap_or_else(|_| "./agent.db".to_string());
    let url = format!("sqlite://{db_path}?mode=rwc");

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;

    // Fase 6: migraciones reales (tablas de files, executions, versions
    // locales, config del agente).
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS agent_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}
