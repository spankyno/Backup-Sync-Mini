use axum::{routing::get, Router};

// Fase 6: aqui se anadiran los endpoints reales del motor de backup
// (listar carpetas, iniciar/cancelar ejecuciones, progreso via WS,
// restauracion, verificacion de integridad, etc). Por ahora se deja
// el esqueleto de rutas agrupado por dominio.

pub fn router() -> Router {
    Router::new()
        .nest("/filesystem", filesystem_routes())
        .nest("/backups", backups_routes())
        .nest("/restore", restore_routes())
}

fn filesystem_routes() -> Router {
    Router::new().route("/browse", get(placeholder))
}

fn backups_routes() -> Router {
    Router::new().route("/", get(placeholder))
}

fn restore_routes() -> Router {
    Router::new().route("/", get(placeholder))
}

async fn placeholder() -> &'static str {
    "not implemented yet"
}
