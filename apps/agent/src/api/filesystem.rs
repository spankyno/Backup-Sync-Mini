use axum::{
    extract::Query,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
pub struct BrowseQuery {
    path: Option<String>,
}

#[derive(Serialize)]
pub struct Entry {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(Serialize)]
pub struct QuickAccessEntry {
    label: String,
    path: String,
}

#[derive(Serialize)]
pub struct BrowseResponse {
    path: String,
    parent: Option<String>,
    entries: Vec<Entry>,
    quick_access: Vec<QuickAccessEntry>,
}

pub async fn browse(Query(query): Query<BrowseQuery>) -> impl IntoResponse {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let target = match query.path {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => home.clone(),
    };

    let entries = match read_entries(&target) {
        Ok(entries) => entries,
        Err(status) => return status.into_response(),
    };

    let parent = target
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    let response = BrowseResponse {
        path: target.to_string_lossy().to_string(),
        parent,
        entries,
        quick_access: quick_access_folders(&home),
    };

    Json(response).into_response()
}

fn read_entries(dir: &Path) -> Result<Vec<Entry>, StatusCode> {
    let read_dir = fs::read_dir(dir).map_err(|err| {
        tracing::warn!("No se pudo leer {:?}: {}", dir, err);
        StatusCode::NOT_FOUND
    })?;

    let mut entries: Vec<Entry> = read_dir
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            // Oculta archivos/carpetas ocultos (los que empiezan por ".")
            !entry.file_name().to_string_lossy().starts_with('.')
        })
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            Some(Entry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                is_dir: metadata.is_dir(),
            })
        })
        .collect();

    // Carpetas primero, luego alfabetico.
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));

    Ok(entries)
}

/// Devuelve solo los accesos rapidos que realmente existen en este
/// equipo (los nombres de carpeta estandar varian entre Windows,
/// macOS y Linux, y no todos los usuarios tienen las seis).
fn quick_access_folders(home: &Path) -> Vec<QuickAccessEntry> {
    let candidates = [
        ("Documentos", vec!["Documents", "Documentos"]),
        ("Escritorio", vec!["Desktop", "Escritorio"]),
        ("Imágenes", vec!["Pictures", "Imagenes", "Imágenes"]),
        ("Vídeos", vec!["Videos", "Vídeos"]),
        ("Descargas", vec!["Downloads", "Descargas"]),
        ("Proyectos", vec!["Projects", "Proyectos", "dev", "code"]),
    ];

    candidates
        .into_iter()
        .filter_map(|(label, names)| {
            names
                .into_iter()
                .map(|name| home.join(name))
                .find(|path| path.is_dir())
                .map(|path| QuickAccessEntry {
                    label: label.to_string(),
                    path: path.to_string_lossy().to_string(),
                })
        })
        .collect()
}
