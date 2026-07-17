use axum::Json;
use serde_json::{json, Value};

pub async fn check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "backuphub-agent",
        "version": env!("CARGO_PKG_VERSION"),
        // std::env::consts::OS: "linux" | "macos" | "windows"
        // La API lo pasa a mayusculas para que encaje con el enum AgentOs.
        "os": std::env::consts::OS,
    }))
}
