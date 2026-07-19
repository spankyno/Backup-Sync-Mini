mod api;
mod core;
mod crypto;
mod storage;

use axum::{routing::get, Router};
use sqlx::sqlite::SqlitePool;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

/// Estado compartido entre handlers HTTP: el pool de SQLite local y el
/// registro de ejecuciones en curso (para poder cancelarlas).
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub executions: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let port: u16 = std::env::var("AGENT_DEFAULT_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3845);

    let pool = storage::db::init_pool().await?;
    let state = AppState {
        pool,
        executions: Arc::new(Mutex::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/health", get(api::health::check))
        .nest(
            "/api/v1",
            api::routes::router()
                .layer(axum::middleware::from_fn(api::auth::require_token)),
        )
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("BackupHub Agent escuchando en http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
