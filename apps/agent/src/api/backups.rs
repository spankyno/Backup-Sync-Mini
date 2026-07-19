use axum::{
    extract::{Path as AxumPath, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

use crate::core::engine::{self, BackupParams};
use crate::storage::db;
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateBackupRequest {
    pub execution_id: String,
    pub plan_id: String,
    pub sources: Vec<String>,
    pub destination_path: String,
    #[serde(default = "default_versioning_max")]
    pub versioning_max: u32,
    #[serde(default)]
    pub compression: bool,
    #[serde(default)]
    pub encryption: bool,
    #[serde(default)]
    pub exclude_filters: Vec<String>,
}

fn default_versioning_max() -> u32 {
    10
}

#[derive(Serialize)]
pub struct StartedResponse {
    status: &'static str,
    execution_id: String,
}

/// POST /api/v1/backups — inicia una ejecucion en una tarea de tokio
/// aparte (no bloquea la respuesta HTTP mientras el backup corre).
pub async fn start(State(state): State<AppState>, Json(req): Json<CreateBackupRequest>) -> impl IntoResponse {
    let token = CancellationToken::new();
    {
        let mut executions = state.executions.lock().await;
        executions.insert(req.execution_id.clone(), token.clone());
    }

    let params = BackupParams {
        execution_id: req.execution_id.clone(),
        plan_id: req.plan_id,
        sources: req.sources,
        destination_path: req.destination_path,
        versioning_max: req.versioning_max,
        compression: req.compression,
        encryption: req.encryption,
        exclude_filters: req.exclude_filters,
    };

    let pool = state.pool.clone();
    let execution_id_for_cleanup = req.execution_id.clone();
    let executions_for_cleanup = state.executions.clone();

    tokio::spawn(async move {
        engine::run_backup(pool, params, token).await;
        executions_for_cleanup.lock().await.remove(&execution_id_for_cleanup);
    });

    (
        StatusCode::ACCEPTED,
        Json(StartedResponse {
            status: "started",
            execution_id: req.execution_id,
        }),
    )
}

/// GET /api/v1/backups/:id — estado y progreso actuales.
pub async fn status(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> impl IntoResponse {
    match engine::get_execution_status(&state.pool, &id).await {
        Ok(Some(row)) => Json(row).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Ejecución no encontrada").into_response(),
        Err(err) => {
            tracing::error!("Error consultando estado de ejecución: {err}");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

#[derive(Serialize)]
pub struct LogEntry {
    level: String,
    message: String,
    created_at: String,
}

/// GET /api/v1/backups/:id/logs
pub async fn logs(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> impl IntoResponse {
    match db::get_logs(&state.pool, &id).await {
        Ok(rows) => Json(
            rows.into_iter()
                .map(|(level, message, created_at)| LogEntry { level, message, created_at })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(err) => {
            tracing::error!("Error leyendo logs: {err}");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

#[derive(Serialize)]
pub struct FileEntry {
    path: String,
    hash: Option<String>,
    size: Option<i64>,
}

/// GET /api/v1/backups/:id/files — manifiesto de archivos copiados en
/// esta ejecución (ruta relativa + hash + tamaño). Lo usa la API para
/// sincronizar el Historial/Inventario en Postgres.
pub async fn files(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> impl IntoResponse {
    match db::get_execution_files(&state.pool, &id).await {
        Ok(rows) => Json(
            rows.into_iter()
                .map(|(path, hash, size)| FileEntry { path, hash, size })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(err) => {
            tracing::error!("Error leyendo el manifiesto de archivos: {err}");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

#[derive(Serialize)]
pub struct CancelResponse {
    status: &'static str,
}

/// POST /api/v1/backups/:id/cancel — pide parar en el siguiente punto de
/// control del bucle (no interrumpe a mitad de un archivo individual).
pub async fn cancel(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> impl IntoResponse {
    let executions = state.executions.lock().await;
    match executions.get(&id) {
        Some(token) => {
            token.cancel();
            Json(CancelResponse { status: "cancelling" }).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            "No hay una ejecución en curso con ese id",
        )
            .into_response(),
    }
}
