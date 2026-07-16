// Fase 2: middleware que valida el token emitido por la Web App al
// emparejar el agente. El agente solo debe aceptar peticiones firmadas
// con un token valido, generado durante el proceso de "conectar equipo".

use axum::http::StatusCode;

pub fn verify_token(token: &str) -> Result<(), StatusCode> {
    let expected = std::env::var("AGENT_TOKEN_SECRET").unwrap_or_default();
    if !expected.is_empty() && token == expected {
        Ok(())
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}
