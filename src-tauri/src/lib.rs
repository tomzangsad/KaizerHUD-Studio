mod codegen;
mod custom_assets;
mod export;
mod guistudio;
mod javaexport;
mod javahud;
mod js;
mod mcp_bridge;
mod overrides;
mod storage;
mod updater;

use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use storage::Storage;
use tauri::{Manager, RunEvent, State};
use tauri_plugin_dialog::DialogExt;

struct AppState {
    storage: Mutex<Storage>,
}

/* ───────────── projects ───────────── */

#[tauri::command]
fn list_projects(state: State<AppState>) -> Result<Vec<Value>, String> {
    state.storage.lock().unwrap().list()
}

#[tauri::command]
fn get_project(state: State<AppState>, id: String) -> Result<Value, String> {
    state.storage.lock().unwrap().get(&id)
}

#[tauri::command]
fn create_project(state: State<AppState>, name: String, data: Value) -> Result<Value, String> {
    state.storage.lock().unwrap().create(&name, data)
}

#[tauri::command]
fn update_project(state: State<AppState>, id: String, name: Option<String>, data: Value) -> Result<Value, String> {
    state.storage.lock().unwrap().update(&id, name.as_deref(), data)
}

#[tauri::command]
fn delete_project(state: State<AppState>, id: String) -> Result<Value, String> {
    state.storage.lock().unwrap().delete(&id)
}

#[tauri::command]
fn open_projects_folder(state: State<AppState>) -> Result<(), String> {
    let dir = state.storage.lock().unwrap().dir().to_path_buf();
    std::process::Command::new("explorer").arg(dir).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err("Folder not found".into());
    }
    std::process::Command::new("explorer").arg(p).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// Opens an http(s) link in the default browser.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) || url.contains('"') {
        return Err("Only http(s) links can be opened".into());
    }
    std::process::Command::new("rundll32")
        .arg("url.dll,FileProtocolHandler")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/* ───────────── live code view + folder sync ───────────── */

/// Readable code of the pack for the Code panel (with the user's overrides).
#[tauri::command]
async fn generate_preview(data: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || export::preview(&data))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn choose_sync_folder(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let picked = app.dialog().file().set_title("Choose the folder to keep the pack in sync").blocking_pick_folder();
    let Some(folder) = picked else { return Ok(None) };
    let path = folder.into_path().map_err(|e| e.to_string())?;
    Ok(Some(json!({
        "path": path.to_string_lossy(),
        "safe": export::folder_is_safe_to_sync(&path),
    })))
}

/// Writes the readable pack into `folder`. Without `force`, refuses folders that
/// contain files this program did not write.
#[tauri::command]
async fn sync_pack(data: Value, folder: String, force: Option<bool>) -> Result<Value, String> {
    let path = PathBuf::from(&folder);
    if !force.unwrap_or(false) && !export::folder_is_safe_to_sync(&path) {
        return Err("FOLDER_NOT_EMPTY".into());
    }
    let count = tauri::async_runtime::spawn_blocking(move || export::sync_folder(&data, &path))
        .await
        .map_err(|e| e.to_string())??;
    Ok(json!({ "files": count }))
}

/* ───────────── Java HUD import ───────────── */

/// Lets the user pick a purchased Java HUD pack (zip or folder) and reads it.
/// Returns `None` if the user cancelled.
#[tauri::command]
async fn import_java_hud(app: tauri::AppHandle, folder: Option<bool>) -> Result<Option<Value>, String> {
    let dialog = app.dialog().file().set_title("Import a Java HUD pack");
    let picked = if folder.unwrap_or(false) {
        dialog.blocking_pick_folder()
    } else {
        dialog.add_filter("HUD pack", &["zip"]).blocking_pick_file()
    };
    let Some(picked) = picked else { return Ok(None) };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || javahud::import_pack(&path))
        .await
        .map_err(|e| e.to_string())?
        .map(Some)
}

/* ───────────── Java HUD config export ───────────── */

/// Zips the BetterHud / MythicHUD files the UI generated and asks where to save them.
/// Returns the saved path, or `None` if the user cancelled.
#[tauri::command]
async fn export_java_hud(app: tauri::AppHandle, files: Vec<javaexport::OutFile>, file_name: Option<String>) -> Result<Option<String>, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || javaexport::build_zip(&files))
        .await
        .map_err(|e| e.to_string())??;
    let picked = app
        .dialog()
        .file()
        .set_title("Save Java HUD config")
        .set_file_name(javaexport::safe_zip_name(&file_name.unwrap_or_default()))
        .add_filter("ZIP archive", &["zip"])
        .blocking_save_file();
    let Some(path) = picked else { return Ok(None) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| format!("Could not write file: {}", e))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/* ───────────── export ───────────── */

/// Builds output.zip and asks the user where to save it.
/// `java_files` (optional): the Java HUD export from the UI, written into the same zip
/// (plugin folders under plugins/, README as README_KaizerHUD_Java.txt).
/// Returns the saved path, or `None` if the user cancelled.
#[tauri::command]
async fn export_project(
    app: tauri::AppHandle,
    data: Value,
    java_files: Option<Vec<javaexport::OutFile>>,
) -> Result<Option<String>, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let extra = match java_files {
            Some(files) if !files.is_empty() => javaexport::files_for_output_zip(&files)?,
            _ => Vec::new(),
        };
        export::build_export_zip_with(export::ExportInput { data: &data }, extra)
    })
    .await
    .map_err(|e| e.to_string())??;

    let picked = app
        .dialog()
        .file()
        .set_title("Save export")
        .set_file_name("output.zip")
        .add_filter("ZIP archive", &["zip"])
        .blocking_save_file();
    let Some(path) = picked else { return Ok(None) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| format!("Could not write file: {}", e))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updater::UpdaterState::default())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let storage = Storage::new(data_dir.join("projects")).map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            app.manage(AppState { storage: Mutex::new(storage) });
            // GUI Studio (gui.html) keeps its projects apart from HUD projects
            app.manage(guistudio::GuiState::new(data_dir.join("gui_projects")).map_err(|e| Box::<dyn std::error::Error>::from(e))?);
            app.manage(custom_assets::CustomAssetsState::new(data_dir.join("custom_assets")).map_err(|e| Box::<dyn std::error::Error>::from(e))?);
            let bridge = mcp_bridge::start_bridge(app.handle().clone(), data_dir).map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            app.manage(bridge);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            get_project,
            create_project,
            update_project,
            delete_project,
            open_projects_folder,
            open_folder,
            open_external,
            generate_preview,
            choose_sync_folder,
            sync_pack,
            export_project,
            import_java_hud,
            export_java_hud,
            guistudio::gui_list_projects,
            guistudio::gui_get_project,
            guistudio::gui_create_project,
            guistudio::gui_update_project,
            guistudio::gui_delete_project,
            guistudio::gui_open_projects_folder,
            guistudio::gui_export,
            updater::get_app_version,
            updater::check_app_update,
            updater::download_app_update,
            updater::install_app_update,
            mcp_bridge::mcp_bridge_hello,
            mcp_bridge::mcp_bridge_reply,
            mcp_bridge::mcp_bridge_info,
            custom_assets::custom_assets_list,
            custom_assets::custom_assets_get_model,
            custom_assets::custom_assets_save_icon,
            custom_assets::custom_assets_scan_path,
            custom_assets::custom_assets_pick_and_import,
            custom_assets::custom_assets_remove_source
        ])
        .build(tauri::generate_context!())
        .expect("error while building KaizerHUD Studio")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(bridge) = app_handle.try_state::<Arc<mcp_bridge::McpBridgeState>>() {
                    bridge.cleanup_bridge();
                }
            }
        });
}
