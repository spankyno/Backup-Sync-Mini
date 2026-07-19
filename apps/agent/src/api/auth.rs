// Middleware que valida el token que la API (o la Web App en modo
// completamente local) presenta al llamar a este agente. Se aplica a
// todas las rutas bajo /api/v1 en main.rs. /health se deja siempre
// publica (sin datos sensibles) para que el registro/ping desde la
// pantalla "Conectar equipo" funcione antes de tener nada mas configurado.

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

pub async fn require_token(request: Request, next: Next) -> Response {
    let expected = std::env::var("AGENT_TOKEN_SECRET").unwrap_or_default();

    if expected.is_empty() {
        tracing::warn!("AGENT_TOKEN_SECRET no configurado: rechazando todas las peticiones autenticadas");
        return (StatusCode::UNAUTHORIZED, "AGENT_TOKEN_SECRET no configurado").into_response();
    }

    let provided = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));

    match provided {
        Some(token) if constant_time_eq(token.as_bytes(), expected.as_bytes()) => {
            next.run(request).await
        }
        _ => (StatusCode::UNAUTHORIZED, "Token invalido").into_response(),
    }
}

/// Comparacion en tiempo constante para evitar timing attacks al
/// validar el token (no usar `==` directo sobre secretos).
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
