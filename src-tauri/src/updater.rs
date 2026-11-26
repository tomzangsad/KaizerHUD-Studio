use serde_json::{json, Value};
use tauri::{async_runtime::Mutex, AppHandle, Emitter, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const RELEASE_TAG_BASE: &str = "https://github.com/tomzangsad/KaizerHUD-Studio/releases/tag";

pub struct PendingUpdate {
    pub update: Update,
    pub bytes: Option<Vec<u8>>,
}

#[derive(Default)]
pub struct UpdaterState(pub Mutex<Option<PendingUpdate>>);

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

fn update_payload(app: &AppHandle, update: &Update, downloaded: bool) -> Value {
    let ver = update.version.clone();
    let tag = if ver.starts_with('v') { ver.clone() } else { format!("v{}", ver) };
    json!({
        "available": true,
        "currentVersion": app.package_info().version.to_string(),
        "version": ver,
        "date": update.date.as_ref().map(|d| d.to_string()),
        "body": update.body.clone().unwrap_or_default(),
        "downloaded": downloaded,
        "releaseUrl": format!("{}/{}", RELEASE_TAG_BASE, tag),
    })
}

#[tauri::command]
pub async fn check_app_update(app: AppHandle, state: State<'_, UpdaterState>) -> Result<Value, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let found = updater.check().await.map_err(|e| e.to_string())?;

    let mut guard = state.0.lock().await;
    let Some(update) = found else {
        *guard = None;
        return Ok(json!({
            "available": false,
            "currentVersion": app.package_info().version.to_string(),
        }));
    };

    let preserved_bytes = match guard.take() {
        Some(prev) if prev.update.version == update.version => prev.bytes,
        _ => None,
    };
    let already_downloaded = preserved_bytes.is_some();
    let payload = update_payload(&app, &update, already_downloaded);
    *guard = Some(PendingUpdate {
        update,
        bytes: preserved_bytes,
    });
    Ok(payload)
}

#[tauri::command]
pub async fn download_app_update(app: AppHandle, state: State<'_, UpdaterState>) -> Result<Value, String> {
    // Take existing update handle out of lock while downloading, or re-check if none stored yet
    let pending = {
        let mut guard = state.0.lock().await;
        guard.take()
    };

    let update = match pending {
        Some(p) if p.bytes.is_some() => {
            let version = p.update.version.clone();
            let mut guard = state.0.lock().await;
            *guard = Some(p);
            let _ = app.emit("kz-update-ready", json!({ "version": version }));
            return Ok(json!({ "version": version, "ready": true }));
        }
        Some(p) => p.update,
        None => {
            let updater = app.updater().map_err(|e| e.to_string())?;
            updater
                .check()
                .await
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "No update is currently available".to_string())?
        }
    };

    let version = update.version.clone();
    let app_for_progress = app.clone();
    let ver_for_progress = version.clone();
    let mut downloaded: u64 = 0;
    let mut last_percent: i64 = -1;

    let bytes = update
        .download(
            move |chunk_len, content_len| {
                downloaded += chunk_len as u64;
                let percent = match content_len {
                    Some(total) if total > 0 => ((downloaded.saturating_mul(100)) / total).min(100) as i64,
                    _ => -1,
                };
                if percent != last_percent || content_len.is_none() {
                    last_percent = percent;
                    let _ = app_for_progress.emit(
                        "kz-update-progress",
                        json!({
                            "version": ver_for_progress,
                            "downloaded": downloaded,
                            "total": content_len,
                            "percent": if percent >= 0 { Some(percent) } else { None::<i64> },
                        }),
                    );
                }
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;

    {
        let mut guard = state.0.lock().await;
        *guard = Some(PendingUpdate {
            update,
            bytes: Some(bytes),
        });
    }

    let _ = app.emit("kz-update-ready", json!({ "version": version }));
    Ok(json!({ "version": version, "ready": true }))
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle, state: State<'_, UpdaterState>) -> Result<(), String> {
    let pending = {
        let mut guard = state.0.lock().await;
        guard.take()
    };

    let Some(PendingUpdate { update, bytes: Some(bytes) }) = pending else {
        return Err("No downloaded update is ready to install".into());
    };

    // Verifies the Ed25519 signature and stages/runs the NSIS update without auto-closing until restart()
    update.install(bytes).map_err(|e| e.to_string())?;
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::UpdaterState;

    #[test]
    fn default_updater_state_starts_empty() {
        let state = UpdaterState::default();
        assert!(state.0.try_lock().unwrap().is_none());
    }
}
