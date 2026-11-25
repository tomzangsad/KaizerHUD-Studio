//! GUI Studio backend (ui/gui.html): cursor GUI projects for the KaizerUI plugin.
//!
//! Kept apart from the HUD editor on purpose:
//! * its own project folder `<app data>/gui_projects/` (HUD projects stay in `projects/`)
//! * its own commands (`gui_*`) and managed state (`GuiState`)
//!
//! The UI (`ui/js/guistudio/gs_export.js`) generates every export file. This module stores
//! projects and packs the export: the plugin files at the root of the zip, the Java resource
//! pack as a nested .zip and the Bedrock pack as a nested .mcpack.

use crate::javaexport::{self, OutFile};
use crate::storage::Storage;
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeSet;
use std::io::{Cursor, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use zip::write::SimpleFileOptions;

pub struct GuiState {
    storage: Mutex<Storage>,
}

impl GuiState {
    pub fn new(dir: PathBuf) -> Result<Self, String> {
        Ok(Self { storage: Mutex::new(Storage::new(dir)?) })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPayload {
    #[serde(default)]
    pub file_name: Option<String>,
    pub root: Vec<OutFile>,
    /// Java resource pack as a nested zip. Empty when the pack goes straight into
    /// ItemsAdder / Nexo / Oraxen (those files are then part of `root`).
    #[serde(default)]
    pub java_pack: Vec<OutFile>,
    #[serde(default)]
    pub java_pack_name: Option<String>,
    pub bedrock_pack: Vec<OutFile>,
    pub bedrock_pack_path: String,
}

/// Same rules as the export file paths: relative, plain segments, forward slashes
fn check_path(p: &str, ext: &str) -> Result<String, String> {
    let p = p.trim();
    let bad = p.is_empty()
        || p.starts_with('/')
        || p.contains('\\')
        || p.contains(':')
        || p.split('/').any(|s| s.is_empty() || s == "." || s == "..")
        || !p.to_ascii_lowercase().ends_with(ext);
    if bad {
        return Err(format!("Invalid file path in export: {}", p));
    }
    Ok(p.to_string())
}

/// Builds the GUI export zip:
/// ```text
/// plugins/KaizerUI/menus/*.yml, plugins/KaizerUI/studio.yml, README_KaizerUI.txt   (root)
/// <java_pack_name>                      nested zip = Java resource pack (only when not merged into a pack plugin)
/// <bedrock_pack_path> (.mcpack)         nested zip = Bedrock resource pack
/// ```
pub fn build_export(p: &ExportPayload) -> Result<Vec<u8>, String> {
    let bedrock_path = check_path(&p.bedrock_pack_path, ".mcpack")?;
    let bedrock_zip = javaexport::build_zip(&p.bedrock_pack)?;

    let mut entries = javaexport::decode_files(&p.root)?;
    if !p.java_pack.is_empty() {
        let java_name = check_path(p.java_pack_name.as_deref().unwrap_or(""), ".zip")?;
        entries.push((java_name, javaexport::build_zip(&p.java_pack)?));
    }
    entries.push((bedrock_path, bedrock_zip));

    let mut seen = BTreeSet::new();
    for (path, _) in &entries {
        if !seen.insert(path.to_ascii_lowercase()) {
            return Err(format!("The export has the same file twice: {}", path));
        }
    }

    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let stored = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (path, bytes) in entries {
        let already_packed = path.ends_with(".zip") || path.ends_with(".mcpack");
        zip.start_file(path.as_str(), if already_packed { stored } else { opts }).map_err(|e| e.to_string())?;
        zip.write_all(&bytes).map_err(|e| e.to_string())?;
    }
    Ok(zip.finish().map_err(|e| e.to_string())?.into_inner())
}

// ── Tauri commands (kept below this line; tests build the module without them) ──
// KZ-GUI-COMMANDS-BEGIN

use tauri::State;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn gui_list_projects(state: State<GuiState>) -> Result<Vec<Value>, String> {
    state.storage.lock().unwrap().list()
}

#[tauri::command]
pub fn gui_get_project(state: State<GuiState>, id: String) -> Result<Value, String> {
    state.storage.lock().unwrap().get(&id)
}

#[tauri::command]
pub fn gui_create_project(state: State<GuiState>, name: String, data: Value) -> Result<Value, String> {
    state.storage.lock().unwrap().create(&name, data)
}

#[tauri::command]
pub fn gui_update_project(state: State<GuiState>, id: String, name: Option<String>, data: Value) -> Result<Value, String> {
    state.storage.lock().unwrap().update(&id, name.as_deref(), data)
}

#[tauri::command]
pub fn gui_delete_project(state: State<GuiState>, id: String) -> Result<Value, String> {
    state.storage.lock().unwrap().delete(&id)
}

#[tauri::command]
pub fn gui_open_projects_folder(state: State<GuiState>) -> Result<(), String> {
    let dir = state.storage.lock().unwrap().dir().to_path_buf();
    std::process::Command::new("explorer").arg(dir).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// Builds the export and asks where to save it. Returns the saved path, or `None` if cancelled.
#[tauri::command]
pub async fn gui_export(app: tauri::AppHandle, payload: ExportPayload) -> Result<Option<String>, String> {
    let name = javaexport::safe_zip_name(payload.file_name.as_deref().unwrap_or("KaizerUI"));
    let bytes = tauri::async_runtime::spawn_blocking(move || build_export(&payload))
        .await
        .map_err(|e| e.to_string())??;
    let picked = app
        .dialog()
        .file()
        .set_title("Save GUI export")
        .set_file_name(name)
        .add_filter("ZIP archive", &["zip"])
        .blocking_save_file();
    let Some(path) = picked else { return Ok(None) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| format!("Could not write file: {}", e))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

// KZ-GUI-COMMANDS-END

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn t(path: &str, text: &str) -> OutFile {
        OutFile { path: path.into(), text: Some(text.into()), base64: None }
    }

    fn payload() -> ExportPayload {
        ExportPayload {
            file_name: Some("KaizerUI_kaizerui".into()),
            root: vec![t("plugins/KaizerUI/menus/main.yml", "id: \"main\"\n"), t("README_KaizerUI.txt", "hi\n")],
            java_pack: vec![t("pack.mcmeta", "{}"), t("assets/kaizerui/font/gui.json", "{\"providers\":[]}")],
            java_pack_name: Some("KaizerUI_kaizerui_java_pack.zip".into()),
            bedrock_pack: vec![t("manifest.json", "{}"), t("ui/server_form.json", "{}")],
            bedrock_pack_path: "plugins/Geyser-Spigot/packs/KaizerUI_kaizerui.mcpack".into(),
        }
    }

    #[test]
    fn export_layout_and_nested_packs() {
        let bytes = build_export(&payload()).unwrap();
        let mut z = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        let names: Vec<String> = (0..z.len()).map(|i| z.by_index(i).unwrap().name().to_string()).collect();
        assert_eq!(names, vec![
            "plugins/KaizerUI/menus/main.yml",
            "README_KaizerUI.txt",
            "KaizerUI_kaizerui_java_pack.zip",
            "plugins/Geyser-Spigot/packs/KaizerUI_kaizerui.mcpack",
        ]);
        let mut inner = vec![];
        z.by_name("plugins/Geyser-Spigot/packs/KaizerUI_kaizerui.mcpack").unwrap().read_to_end(&mut inner).unwrap();
        let mut zi = zip::ZipArchive::new(Cursor::new(inner)).unwrap();
        let mut s = String::new();
        zi.by_name("ui/server_form.json").unwrap().read_to_string(&mut s).unwrap();
        assert_eq!(s, "{}");
        let mut jinner = vec![];
        z.by_name("KaizerUI_kaizerui_java_pack.zip").unwrap().read_to_end(&mut jinner).unwrap();
        let zj = zip::ZipArchive::new(Cursor::new(jinner)).unwrap();
        assert_eq!(zj.len(), 2);
    }

    #[test]
    fn rejects_bad_pack_names() {
        let mut p = payload();
        p.java_pack_name = Some("../evil.zip".into());
        assert!(build_export(&p).is_err());
        let mut p = payload();
        p.bedrock_pack_path = "plugins/x.zip".into();
        assert!(build_export(&p).is_err());
        let mut p = payload();
        p.root.push(t("KaizerUI_kaizerui_java_pack.zip", "dup"));
        assert!(build_export(&p).is_err());
        let mut p = payload();
        p.bedrock_pack.clear();
        assert!(build_export(&p).is_err());
    }

    #[test]
    fn java_pack_merged_into_itemsadder() {
        let mut p = payload();
        p.java_pack.clear();
        p.java_pack_name = None;
        p.root.push(t("plugins/ItemsAdder/contents/kaizerui_gui/resourcepack/assets/kaizerui/font/gui.json", "{}"));
        let bytes = build_export(&p).unwrap();
        let z = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        let names: Vec<&str> = z.file_names().collect();
        assert!(names.contains(&"plugins/ItemsAdder/contents/kaizerui_gui/resourcepack/assets/kaizerui/font/gui.json"));
        assert!(!names.iter().any(|n| n.ends_with("_java_pack.zip")));
        assert_eq!(z.len(), 4);
    }

    #[test]
    fn gui_projects_live_in_their_own_folder() {
        let dir = std::env::temp_dir().join(format!("kz_gui_test_{}", std::process::id()));
        let st = GuiState::new(dir.join("gui_projects")).unwrap();
        let s = st.storage.lock().unwrap();
        let r = s.create("My GUI", serde_json::json!({"kind": "kaizer-gui"})).unwrap();
        let id = r["projectId"].as_str().unwrap().to_string();
        assert!(dir.join("gui_projects").join(format!("{}.json", id)).exists());
        assert_eq!(s.get(&id).unwrap()["data"]["kind"], "kaizer-gui");
        assert_eq!(s.list().unwrap().len(), 1);
        drop(s);
        let _ = std::fs::remove_dir_all(dir);
    }
}
