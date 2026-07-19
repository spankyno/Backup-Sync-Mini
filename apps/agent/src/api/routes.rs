use axum::{
    routing::{get, post},
    Router,
};
use super::{backups, filesystem};
use crate::AppState;

// El listado de carpetas (Fase 5) y el motor de backup (Fase 6) ya son
// funcionales. La restauracion (Fase 8) sigue como placeholder.

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/filesystem", filesystem_routes())
        .nest("/backups", backups_routes())
        .nest("/restore", restore_routes())
}

fn filesystem_routes() -> Router<AppState> {
    Router::new().route("/browse", get(filesystem::browse))
}

fn backups_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(backups::start))
        .route("/:id", get(backups::status))
        .route("/:id/logs", get(backups::logs))
        .route("/:id/files", get(backups::files))
        .route("/:id/cancel", post(backups::cancel))
}

fn restore_routes() -> Router<AppState> {
    Router::new().route("/", get(placeholder))
}

async fn placeholder() -> &'static str {
    "not implemented yet"
}
