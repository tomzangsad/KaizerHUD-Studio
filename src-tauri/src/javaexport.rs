//! Java HUD config export (BetterHud / MythicHUD + ItemsAdder / Nexo / Oraxen).
//!
//! The UI (`ui/js/javaexport.js`) turns the project into a list of plugin files
//! (YAML as text, pictures as base64 PNG). This module only checks the paths and
//! packs them into one zip laid out like a purchased pack: the zip's top folders
//! are dropped straight into the server's `plugins/` folder.

use base64::Engine;
use serde::Deserialize;
use std::collections::BTreeSet;
use std::io::{Cursor, Write};
use zip::write::SimpleFileOptions;

const MAX_FILES: usize = 20_000;
const MAX_TOTAL_BYTES: usize = 256 * 1024 * 1024;

#[derive(Debug, Deserialize)]
pub struct OutFile {
    pub path: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub base64: Option<String>,
}

/// A relative path made of plain segments (no `..`, no drive letters, no backslashes)
fn clean_path(p: &str) -> Result<String, String> {
    let p = p.trim();
    let bad = p.is_empty()
        || p.starts_with('/')
        || p.contains('\\')
        || p.contains(':')
        || p.split('/').any(|s| s.is_empty() || s == "." || s == "..");
    if bad {
        return Err(format!("Invalid file path in export: {}", p));
    }
    Ok(p.to_string())
}

/// Checks the paths and decodes the files the UI generated: (path, bytes) in the given order.
pub fn decode_files(files: &[OutFile]) -> Result<Vec<(String, Vec<u8>)>, String> {
    if files.is_empty() {
        return Err("Nothing to export".into());
    }
    if files.len() > MAX_FILES {
        return Err("Too many files in the export".into());
    }
    let mut out = Vec::with_capacity(files.len());
    let mut seen = BTreeSet::new();
    let mut total = 0usize;
    for f in files {
        let path = clean_path(&f.path)?;
        if !seen.insert(path.to_ascii_lowercase()) {
            return Err(format!("The export has the same file twice: {}", path));
        }
        let bytes = match (&f.text, &f.base64) {
            (Some(t), _) => t.as_bytes().to_vec(),
            (None, Some(b)) => {
                let b = b.trim();
                let b = b.split_once("base64,").map(|(_, r)| r).unwrap_or(b);
                base64::engine::general_purpose::STANDARD
                    .decode(b)
                    .map_err(|e| format!("Picture {} could not be read: {}", path, e))?
            }
            (None, None) => return Err(format!("File {} has no content", path)),
        };
        total += bytes.len();
        if total > MAX_TOTAL_BYTES {
            return Err("The export is too large".into());
        }
        out.push((path, bytes));
    }
    Ok(out)
}

/// Builds the zip from the files the UI generated.
pub fn build_zip(files: &[OutFile]) -> Result<Vec<u8>, String> {
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (path, bytes) in decode_files(files)? {
        zip.start_file(path.as_str(), opts).map_err(|e| e.to_string())?;
        zip.write_all(&bytes).map_err(|e| e.to_string())?;
    }
    let cursor = zip.finish().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

/// Where a Java export file goes inside output.zip: the plugin folders sit next to
/// KaizerMultiBar under `plugins/`, the README goes to the root as README_KaizerHUD_Java.txt.
pub fn output_zip_path(path: &str) -> String {
    if path == "README_KaizerHUD.txt" {
        "README_KaizerHUD_Java.txt".into()
    } else {
        format!("plugins/{}", path)
    }
}

/// The Java files laid out for output.zip (see `output_zip_path`).
pub fn files_for_output_zip(files: &[OutFile]) -> Result<Vec<(String, Vec<u8>)>, String> {
    Ok(decode_files(files)?.into_iter().map(|(p, b)| (output_zip_path(&p), b)).collect())
}

/// File name for the save dialog: letters, digits, `_ - .` only, always `.zip`
pub fn safe_zip_name(name: &str) -> String {
    let stem: String = name
        .trim()
        .trim_end_matches(".zip")
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.' { c } else { '_' })
        .collect();
    let stem = stem.trim_matches(|c| c == '_' || c == '.').to_string();
    format!("{}.zip", if stem.is_empty() { "java_hud".to_string() } else { stem })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn f(path: &str, text: &str) -> OutFile {
        OutFile { path: path.into(), text: Some(text.into()), base64: None }
    }

    #[test]
    fn zip_round_trip() {
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
        let files = vec![
            f("BetterHud/config.yml", "debug: false\n"),
            OutFile { path: "BetterHud/assets/kz/a.png".into(), text: None, base64: Some(format!("data:image/png;base64,{}", png)) },
        ];
        let bytes = build_zip(&files).unwrap();
        let mut z = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        assert_eq!(z.len(), 2);
        let mut s = String::new();
        z.by_name("BetterHud/config.yml").unwrap().read_to_string(&mut s).unwrap();
        assert_eq!(s, "debug: false\n");
        let mut b = vec![];
        z.by_name("BetterHud/assets/kz/a.png").unwrap().read_to_end(&mut b).unwrap();
        assert_eq!(&b[1..4], b"PNG");
    }

    #[test]
    fn rejects_bad_paths() {
        for p in ["../x.yml", "/abs.yml", "a//b", "C:/x", "a\\b", "a/./b", ""] {
            assert!(build_zip(&[f(p, "x")]).is_err(), "{}", p);
        }
        assert!(build_zip(&[f("a/b.yml", "1"), f("A/B.yml", "2")]).is_err());
    }

    #[test]
    fn output_zip_layout() {
        let files = vec![
            f("BetterHud/config.yml", "debug: false\n"),
            f("ItemsAdder/contents/custom_hud_hotbar/resourcepack/x.yml", "a: 1\n"),
            f("README_KaizerHUD.txt", "read me\n"),
        ];
        let out = files_for_output_zip(&files).unwrap();
        let paths: Vec<&str> = out.iter().map(|(p, _)| p.as_str()).collect();
        assert_eq!(paths, vec![
            "plugins/BetterHud/config.yml",
            "plugins/ItemsAdder/contents/custom_hud_hotbar/resourcepack/x.yml",
            "README_KaizerHUD_Java.txt",
        ]);
        assert_eq!(out[0].1, b"debug: false\n");
        assert!(files_for_output_zip(&[f("../x", "1")]).is_err());
    }

    #[test]
    fn zip_names() {
        assert_eq!(safe_zip_name("My HUD"), "My_HUD.zip");
        assert_eq!(safe_zip_name("kz_hud_BetterHud.zip"), "kz_hud_BetterHud.zip");
        assert_eq!(safe_zip_name("ฮัด"), "java_hud.zip");
    }
}
