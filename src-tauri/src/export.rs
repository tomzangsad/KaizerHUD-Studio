//! Port of `server_export.js`: builds `output.zip` containing the `.mcpack`
//! resource pack and the KaizerMultiBar `config.yml`.

use crate::codegen;
use crate::js::{self, get, str_eq};
use crate::overrides;
use base64::Engine;
use chrono::{Datelike, Timelike};
use indexmap::IndexMap;
use serde_json::Value;
use std::collections::HashSet;
use std::io::{Cursor, Write};
use zip::write::SimpleFileOptions;

const PACK_ICON: &[u8] = include_bytes!("../assets/favicon.png");
const XP_BAR_EMPTY: &[u8] = include_bytes!("../assets/xpbarempty.png");
const ELIPSES: &[u8] = include_bytes!("../assets/elipses.png");
const ELIPSES1: &[u8] = include_bytes!("../assets/elipses1.png");
const BOSSBAR_GLOBAL_VARS: &[u8] = include_bytes!("../assets/bossbar_inv/_global_variables.json");
const BOSSBAR_EMPTY: &[u8] = include_bytes!("../assets/bossbar_inv/empty_progress_bar.png");
const BOSSBAR_FILLED: &[u8] = include_bytes!("../assets/bossbar_inv/filled_progress_bar.png");

/// Zip writer that mimics JSZip: stored entries, parent folder entries, and
/// adding the same path twice replaces the earlier file in place.
struct ZipBuilder {
    /// path → contents (`None` = folder), in insertion order
    entries: IndexMap<String, Option<Vec<u8>>>,
    opts: SimpleFileOptions,
}

impl ZipBuilder {
    fn new() -> Self {
        let now = chrono::Local::now();
        let mut opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        if let Ok(dt) = zip::DateTime::from_date_and_time(
            now.year().clamp(1980, 2107) as u16,
            now.month() as u8,
            now.day() as u8,
            now.hour() as u8,
            now.minute() as u8,
            now.second() as u8,
        ) {
            opts = opts.last_modified_time(dt);
        }
        Self { entries: IndexMap::new(), opts }
    }

    fn ensure_dir(&mut self, dir: &str) {
        if dir.is_empty() || self.entries.contains_key(dir) {
            return;
        }
        if let Some((parent, _)) = dir.trim_end_matches('/').rsplit_once('/') {
            self.ensure_dir(&format!("{}/", parent));
        }
        self.entries.insert(dir.to_string(), None);
    }

    fn file(&mut self, name: &str, data: &[u8]) -> Result<(), String> {
        if let Some((parent, _)) = name.rsplit_once('/') {
            self.ensure_dir(&format!("{}/", parent));
        }
        self.entries.insert(name.to_string(), Some(data.to_vec()));
        Ok(())
    }

    fn finish(self) -> Result<Vec<u8>, String> {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (name, data) in &self.entries {
            match data {
                None => zip.add_directory(name.trim_end_matches('/'), self.opts).map_err(|e| e.to_string())?,
                Some(bytes) => {
                    zip.start_file(name.as_str(), self.opts).map_err(|e| e.to_string())?;
                    zip.write_all(bytes).map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(zip.finish().map_err(|e| e.to_string())?.into_inner())
    }
}

/// Lenient base64 decoding like Node's `Buffer.from(str, 'base64')`.
pub fn decode_base64_lenient(s: &str) -> Vec<u8> {
    let mut clean: String = s
        .chars()
        .map(|c| match c {
            '-' => '+',
            '_' => '/',
            c => c,
        })
        .take_while(|c| *c != '=')
        .filter(|c| c.is_ascii_alphanumeric() || *c == '+' || *c == '/')
        .collect();
    if clean.len() % 4 == 1 {
        clean.pop();
    }
    base64::engine::general_purpose::STANDARD_NO_PAD
        .decode(clean.as_bytes())
        .unwrap_or_default()
}

/// `dataUrl.split(',')[1]` decoded.
fn data_url_bytes(data_url: &str) -> Option<Vec<u8>> {
    let b64 = data_url.split(',').nth(1)?;
    Some(decode_base64_lenient(b64))
}

/// Matches `^data:image\/(\w+);base64,(.+)$` and returns the decoded bytes.
pub fn image_data_bytes(data_url: &str) -> Option<Vec<u8>> {
    let rest = data_url.strip_prefix("data:image/")?;
    let (ext, rest) = rest.split_once(";base64,")?;
    if ext.is_empty() || !ext.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return None;
    }
    if rest.is_empty() || rest.contains('\n') || rest.contains('\r') {
        return None;
    }
    Some(decode_base64_lenient(rest))
}

fn crop_png(img: &image::RgbaImage, x: u32, y: u32, w: u32, h: u32) -> Result<Vec<u8>, String> {
    let mut out = image::RgbaImage::new(w, h);
    for row in 0..h {
        for col in 0..w {
            let (sx, sy) = (x + col, y + row);
            if sx < img.width() && sy < img.height() {
                out.put_pixel(col, row, *img.get_pixel(sx, sy));
            }
        }
    }
    let mut buf = Vec::new();
    image::DynamicImage::ImageRgba8(out)
        .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(buf)
}

/// The frames of an animated image side by side (frame 1 at the left), each scaled to the
/// frame size codegen uses for `uv_size` / `frame_step`. None for a still image.
pub fn anim_strip(img: &Value) -> Option<Vec<u8>> {
    let (n, w, h, _) = codegen::image_anim(img)?;
    let frames = get(img, "animFrames")?.as_array()?;
    let mut strip = image::RgbaImage::new(w * n as u32, h);
    for (i, f) in frames.iter().enumerate().take(n) {
        let bytes = f.as_str().and_then(image_data_bytes)?;
        let mut fr = image::load_from_memory(&bytes).ok()?.to_rgba8();
        if fr.dimensions() != (w, h) {
            fr = image::imageops::resize(&fr, w, h, image::imageops::FilterType::Nearest);
        }
        image::imageops::replace(&mut strip, &fr, (i as u32 * w) as i64, 0);
    }
    let mut buf = Vec::new();
    image::DynamicImage::ImageRgba8(strip).write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png).ok()?;
    Some(buf)
}

/// Slices widgets.png into hotbar_0..8 and selected_hotbar_slot.
fn slice_widgets_image(data_url: &str) -> Vec<(String, Vec<u8>)> {
    let attempt = || -> Result<Vec<(String, Vec<u8>)>, String> {
        let bytes = data_url_bytes(data_url).ok_or("invalid data url")?;
        let img = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?
            .to_rgba8();
        let mut out = vec![];
        for i in 0..9u32 {
            out.push((format!("hotbar_{}", i), crop_png(&img, 1 + i * 20, 0, 20, 22)?));
        }
        out.push(("selected_hotbar_slot".to_string(), crop_png(&img, 0, 22, 24, 24)?));
        Ok(out)
    };
    attempt().unwrap_or_else(|e| {
        eprintln!("Error slicing widgets image: {}", e);
        vec![]
    })
}

pub struct ExportInput<'a> {
    pub data: &'a Value,
}

/// Elements / namespace / overrides read from the editor's project data.
pub struct ProjectView<'a> {
    pub data: &'a Value,
    pub elements: &'a [Value],
    pub namespace: String,
}

static EMPTY: Vec<Value> = Vec::new();

impl<'a> ProjectView<'a> {
    pub fn new(data: &'a Value) -> Self {
        let elements: &'a [Value] = match get(data, "elements") {
            Some(Value::Array(a)) => a,
            _ => &EMPTY,
        };
        let namespace = match get(data, "namespace") {
            v if js::truthy(v) => js::js_string(v),
            _ => "custom_hud".to_string(),
        };
        Self { data, elements, namespace }
    }

    fn override_for(&self, path: &str) -> Option<&'a Value> {
        get(self.data, "codeOverrides").and_then(|o| o.get(path)).filter(|v| !v.is_null())
    }

    /// Stable pack UUIDs stored in the project (random when missing)
    fn pack_uuids(&self) -> Option<[String; 2]> {
        let arr = get(self.data, "packUuids")?.as_array()?;
        let a = arr.first()?.as_str()?;
        let b = arr.get(1)?.as_str()?;
        if uuid::Uuid::parse_str(a).is_ok() && uuid::Uuid::parse_str(b).is_ok() {
            Some([a.to_string(), b.to_string()])
        } else {
            None
        }
    }

    pub fn manifest(&self) -> (Value, Value) {
        let generated = codegen::generate_manifest_json_with(&self.namespace, self.pack_uuids());
        let mut finished = generated.clone();
        if let Some(p) = self.override_for("manifest.json") {
            overrides::apply(&mut finished, p);
        }
        (generated, finished)
    }

    pub fn ui_files(&self) -> codegen::Files {
        codegen::generate_split_files_patched_with(
            &self.namespace,
            self.elements,
            self.override_for("ui/hud_screen.json"),
            &codegen::HudOptions::from_data(self.data),
        )
    }

    /// (generated, final) config.yml — the override replaces the whole file
    pub fn config_yml(&self) -> (String, String) {
        let generated = codegen::generate_kaizer_multibar_config_yml_with(self.elements, codegen::HudChannel::from_data(self.data));
        let finished = match self.override_for("config.yml") {
            Some(Value::String(text)) => text.clone(),
            _ => generated.clone(),
        };
        (generated, finished)
    }
}

/// Every file of the resource pack (path → bytes), in JSZip order.
pub fn build_pack_files(view: &ProjectView) -> Vec<(String, Vec<u8>)> {
    let elements = view.elements;
    let mut out: Vec<(String, Vec<u8>)> = Vec::new();
    let mut put = |path: String, bytes: Vec<u8>| {
        // adding the same path twice replaces the earlier file (like JSZip)
        if let Some(slot) = out.iter_mut().find(|(p, _)| *p == path) {
            slot.1 = bytes;
        } else {
            out.push((path, bytes));
        }
    };

    // 1. manifest.json
    let (_, manifest) = view.manifest();
    put("manifest.json".into(), js::stringify(&manifest, 4).into_bytes());

    // 2. pack_icon.png
    put("pack_icon.png".into(), PACK_ICON.to_vec());

    // 3. UI JSON files
    for (path, content) in view.ui_files() {
        put(path, js::stringify(&content, 4).into_bytes());
    }

    // 4. Image element textures (animated images: one horizontal strip of all frames)
    let mut used_paths: HashSet<String> = HashSet::new();
    for img in elements.iter().filter(|e| str_eq(get(e, "type"), "image")) {
        let still = get(img, "imageData").and_then(|v| v.as_str()).and_then(image_data_bytes);
        let bytes = match anim_strip(img).or(still) {
            Some(b) => b,
            None => continue,
        };
        let tp = js::js_string(get(img, "texturePath"));
        let original = if tp.ends_with(".png") { tp } else { format!("{}.png", tp) };
        let mut tex = original.clone();
        let mut counter = 1;
        while used_paths.contains(&tex) {
            tex = js::replace_first(&original, ".png", &format!("_{}.png", counter));
            counter += 1;
        }
        used_paths.insert(tex.clone());
        let no_ext = js::replace_first(&tex, ".png", "");
        put(format!("{}.png", no_ext), bytes);
    }

    // 5. Bar textures (16 slices)
    let bars: Vec<&Value> = elements.iter().filter(|e| str_eq(get(e, "type"), "bar")).collect();
    for bar in &bars {
        let resolved = codegen::resolve_bar_for_render(elements, bar);
        if let Some(Value::Array(slices)) = get(&resolved, "slicedImages") {
            if slices.len() == 16 {
                let base = js::js_string(get(&resolved, "barTexturePath"));
                for (i, s) in slices.iter().enumerate() {
                    let url = match s.as_str() {
                        Some(u) if !u.is_empty() => u,
                        _ => continue,
                    };
                    let bytes = match data_url_bytes(url) {
                        Some(b) => b,
                        None => continue,
                    };
                    put(format!("{}/{}.png", base, i + 1), bytes);
                }
            }
        }
    }

    // 6. XP bar empty texture
    if bars.iter().any(|b| str_eq(get(b, "barType"), "exp")) {
        put("textures/ui/xpbarempty.png".into(), XP_BAR_EMPTY.to_vec());
    }

    // 8. Widgets textures
    if let Some(w) = get(view.data, "widgetsImageData").filter(|v| js::truthy(Some(*v))) {
        for (name, buf) in slice_widgets_image(&js::js_string(Some(w))) {
            put(format!("textures/ui/{}.png", name), buf);
        }
    }

    // 9. Elipses button textures
    put("textures/ui/elipses.png".into(), ELIPSES.to_vec());
    put("textures/ui/elipses1.png".into(), ELIPSES1.to_vec());

    // 10. Bossbar inventory assets
    put("subpacks/white/ui/_global_variables.json".into(), BOSSBAR_GLOBAL_VARS.to_vec());
    // transparent bar textures hide OUR boss bar's bar; with the action bar / title channel there
    // is no boss bar of ours, so other plugins' boss bars keep their normal look
    if codegen::HudChannel::from_data(view.data) == codegen::HudChannel::Bossbar {
        put("textures/ui/empty_progress_bar.png".into(), BOSSBAR_EMPTY.to_vec());
        put("textures/ui/filled_progress_bar.png".into(), BOSSBAR_FILLED.to_vec());
    }

    out
}

pub fn build_export_zip(input: ExportInput) -> Result<Vec<u8>, String> {
    build_export_zip_with(input, Vec::new())
}

/// output.zip plus extra files (e.g. the Java HUD export, already laid out under `plugins/`).
/// An extra file may not replace one of output.zip's own files.
pub fn build_export_zip_with(input: ExportInput, extra: Vec<(String, Vec<u8>)>) -> Result<Vec<u8>, String> {
    let view = ProjectView::new(input.data);
    let mut mcpack = ZipBuilder::new();
    for (path, bytes) in build_pack_files(&view) {
        mcpack.file(&path, &bytes)?;
    }
    let mcpack_bytes = mcpack.finish()?;

    let mut output = ZipBuilder::new();
    output.file(&format!("GeyserMC/packs/{}.mcpack", view.namespace), &mcpack_bytes)?;
    let (_, yml) = view.config_yml();
    output.file("plugins/KaizerMultiBar/config.yml", yml.as_bytes())?;
    for (path, bytes) in extra {
        if output.entries.keys().any(|k| k.eq_ignore_ascii_case(&path)) {
            return Err(format!("The Java export would replace {} in output.zip", path));
        }
        output.file(&path, &bytes)?;
    }
    output.finish()
}

/// Live code view: readable text files with both the generated
/// base and the final text (after the user's overrides), plus the list of
/// binary files that will be in the pack.
pub fn preview(data: &Value) -> Value {
    let view = ProjectView::new(data);
    let mut files: Vec<Value> = Vec::new();
    let mut push = |path: &str, lang: &str, generated: String, finished: String, editable: bool| {
        files.push(serde_json::json!({
            "path": path,
            "lang": lang,
            "generated": generated,
            "content": finished,
            "editable": editable,
            "overridden": view.override_for(path).is_some(),
        }));
    };

    let (gen_manifest, manifest) = view.manifest();
    push("manifest.json", "json", js::stringify(&gen_manifest, 4), js::stringify(&manifest, 4), true);

    let generated_ui =
        codegen::generate_split_files_patched_with(&view.namespace, view.elements, None, &codegen::HudOptions::from_data(view.data));
    let final_ui = view.ui_files();
    for (path, content) in &final_ui {
        let gen = generated_ui.get(path).map(|v| js::stringify(v, 4)).unwrap_or_default();
        push(path, "json", gen, js::stringify(content, 4), path == "ui/hud_screen.json");
    }
    let globals = String::from_utf8_lossy(BOSSBAR_GLOBAL_VARS).into_owned();
    push("subpacks/white/ui/_global_variables.json", "json", globals.clone(), globals, false);
    let (gen_yml, yml) = view.config_yml();
    push("config.yml", "yaml", gen_yml, yml, true);

    let assets: Vec<Value> = build_pack_files(&view)
        .into_iter()
        .filter(|(p, _)| p.ends_with(".png"))
        .map(|(p, b)| serde_json::json!({ "path": p, "size": b.len() }))
        .collect();

    serde_json::json!({ "files": files, "assets": assets, "namespace": view.namespace })
}

/// Marker file listing what this program wrote into a synced folder.
pub const SYNC_MARKER: &str = ".kaizerhud-sync.json";

fn safe_rel(path: &str) -> bool {
    !path.contains("..") && !path.starts_with('/') && !path.starts_with('\\') && !path.contains(':')
}

/// Writes the readable pack into `folder` (e.g. Minecraft's
/// development_resource_packs/<pack>). Only files this program wrote before
/// (listed in the marker file) are ever deleted.
pub fn sync_folder(data: &Value, folder: &std::path::Path) -> Result<usize, String> {
    use std::fs;
    fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    let marker = folder.join(SYNC_MARKER);
    let previous: Vec<String> = fs::read_to_string(&marker)
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|v| v.get("files").cloned())
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let view = ProjectView::new(data);
    let files = build_pack_files(&view);
    let mut written: Vec<String> = Vec::new();
    for (path, bytes) in &files {
        if !safe_rel(path) {
            continue;
        }
        let target = folder.join(path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let unchanged = fs::read(&target).map(|old| old == *bytes).unwrap_or(false);
        if !unchanged {
            fs::write(&target, bytes).map_err(|e| format!("{}: {}", path, e))?;
        }
        written.push(path.clone());
    }
    // remove files written last time that are no longer part of the pack
    for old in previous.iter().filter(|p| !written.contains(p)) {
        if !safe_rel(old) {
            continue;
        }
        let p = folder.join(old);
        let _ = fs::remove_file(&p);
        let mut dir = p.parent().map(|d| d.to_path_buf());
        while let Some(d) = dir {
            if d == folder || fs::remove_dir(&d).is_err() {
                break;
            }
            dir = d.parent().map(|x| x.to_path_buf());
        }
    }
    let marker_json = serde_json::json!({ "app": "KaizerHUD Studio", "files": written });
    fs::write(&marker, serde_json::to_vec_pretty(&marker_json).unwrap()).map_err(|e| e.to_string())?;
    Ok(written.len())
}

/// True when `folder` is missing, empty, or was synced by this program before.
pub fn folder_is_safe_to_sync(folder: &std::path::Path) -> bool {
    if !folder.exists() || folder.join(SYNC_MARKER).exists() {
        return true;
    }
    std::fs::read_dir(folder).map(|mut d| d.next().is_none()).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    /// Writes the same outputs as the Node reference script so they can be diffed.
    /// Runs only when KZ_FIXTURES / KZ_OUT are set.
    #[test]
    fn dump_fixture_outputs() {
        let (Ok(fixtures), Ok(out)) = (std::env::var("KZ_FIXTURES"), std::env::var("KZ_OUT")) else {
            return;
        };
        for name in ["fixture_full", "fixture_notext", "fixture_text"] {
            let text = std::fs::read_to_string(Path::new(&fixtures).join(format!("{}.json", name))).unwrap();
            let data: Value = serde_json::from_str(&text).unwrap();
            let empty = vec![];
            let elements = match get(&data, "elements") {
                Some(Value::Array(a)) => a,
                _ => &empty,
            };
            let ns = match get(&data, "namespace") {
                v if js::truthy(v) => js::js_string(v),
                _ => "custom_hud".to_string(),
            };
            let dir = Path::new(&out).join(name);
            std::fs::create_dir_all(&dir).unwrap();
            let w = |f: &str, s: String| std::fs::write(dir.join(f), s).unwrap();
            let dev = codegen::generate_split_files(&ns, elements);
            w("dev_hud_screen.json", js::stringify(&dev["ui/hud_screen.json"], 4));
            w("dev_ui_defs.json", js::stringify(&dev["ui/_ui_defs.json"], 4));
            w("config.yml", codegen::generate_kaizer_multibar_config_yml(elements));
            let zip = build_export_zip(ExportInput { data: &data }).unwrap();
            std::fs::write(dir.join("output.zip"), zip).unwrap();
        }
    }

    /// Extra (Java) files land next to KaizerMultiBar under plugins/ and cannot replace output.zip's own files.
    #[test]
    fn output_zip_with_java_files() {
        let data = serde_json::json!({
            "namespace": "jz_test",
            "elements": [
                { "id": 1, "type": "player_head", "name": "Head", "anchor_from": "top_left", "anchor_to": "top_left",
                  "offset": [1, 18], "size": [35, 31], "layer": 101, "alpha": 1 }
            ]
        });
        let extra = vec![
            ("plugins/BetterHud/config.yml".to_string(), b"debug: false\n".to_vec()),
            ("README_KaizerHUD_Java.txt".to_string(), b"read me\n".to_vec()),
        ];
        let bytes = build_export_zip_with(ExportInput { data: &data }, extra).unwrap();
        let mut z = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
        let names: Vec<String> = (0..z.len()).map(|i| z.by_index(i).unwrap().name().to_string()).collect();
        for n in ["GeyserMC/packs/jz_test.mcpack", "plugins/KaizerMultiBar/config.yml", "plugins/BetterHud/config.yml", "README_KaizerHUD_Java.txt"] {
            assert!(names.iter().any(|x| x == n), "missing {} in {:?}", n, names);
        }
        let clash = vec![("plugins/KaizerMultiBar/config.yml".to_string(), b"x".to_vec())];
        assert!(build_export_zip_with(ExportInput { data: &data }, clash).is_err());
    }

    /// Overrides reach readable output, the live preview
    /// reports them, and folder sync writes / cleans up only its own files.
    #[test]
    fn overrides_preview_and_sync() {
        let data = serde_json::json!({
            "namespace": "ov_test",
            "packUuids": ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
            "elements": [
                { "id": 1, "type": "player_head", "name": "Head", "anchor_from": "top_left", "anchor_to": "top_left",
                  "offset": [1, 18], "size": [35, 31], "layer": 101, "alpha": 1 }
            ],
            "codeOverrides": {
                "ui/hud_screen.json": { "my_custom_key": { "type": "panel", "size": [1, 1] } },
                "config.yml": "# custom config\n"
            }
        });

        // live preview: generated base + final text + flags
        let p = preview(&data);
        let hud = p["files"].as_array().unwrap().iter().find(|f| f["path"] == "ui/hud_screen.json").unwrap();
        assert!(hud["content"].as_str().unwrap().contains("my_custom_key"));
        assert!(!hud["generated"].as_str().unwrap().contains("my_custom_key"));
        assert_eq!(hud["overridden"], true);
        let yml = p["files"].as_array().unwrap().iter().find(|f| f["path"] == "config.yml").unwrap();
        assert_eq!(yml["content"], "# custom config\n");

        // stable UUIDs + override in output
        let view = ProjectView::new(&data);
        assert_eq!(view.manifest().1["header"]["uuid"], "11111111-1111-4111-8111-111111111111");
        let readable = build_pack_files(&view);
        let hud_text = String::from_utf8(readable.iter().find(|(p, _)| p == "ui/hud_screen.json").unwrap().1.clone()).unwrap();
        assert!(hud_text.contains("my_custom_key"));

        // folder sync
        let dir = std::env::temp_dir().join(format!("kz_sync_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        assert!(folder_is_safe_to_sync(&dir));
        let n = sync_folder(&data, &dir).unwrap();
        assert!(n > 5);
        assert!(dir.join("ui/hud_screen.json").exists());
        assert!(dir.join(SYNC_MARKER).exists());
        // a stale file we wrote earlier is removed, a user file is kept
        let mut marker: Value = serde_json::from_str(&std::fs::read_to_string(dir.join(SYNC_MARKER)).unwrap()).unwrap();
        marker["files"].as_array_mut().unwrap().push(Value::String("textures/old/stale.png".into()));
        std::fs::write(dir.join(SYNC_MARKER), marker.to_string()).unwrap();
        std::fs::create_dir_all(dir.join("textures/old")).unwrap();
        std::fs::write(dir.join("textures/old/stale.png"), b"x").unwrap();
        std::fs::write(dir.join("my_notes.txt"), b"keep me").unwrap();
        sync_folder(&data, &dir).unwrap();
        assert!(!dir.join("textures/old/stale.png").exists());
        assert!(!dir.join("textures/old").exists());
        assert!(dir.join("my_notes.txt").exists());
        // a foreign, non-empty folder is not considered safe
        let foreign = std::env::temp_dir().join(format!("kz_sync_foreign_{}", std::process::id()));
        std::fs::create_dir_all(&foreign).unwrap();
        std::fs::write(foreign.join("pack.txt"), b"other").unwrap();
        assert!(!folder_is_safe_to_sync(&foreign));
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&foreign);
    }

    #[test]
    fn animated_image_strip() {
        use base64::Engine;
        let png = |w: u32, h: u32, c: u8| {
            let img = image::RgbaImage::from_pixel(w, h, image::Rgba([c, c, c, 255]));
            let mut buf = Vec::new();
            image::DynamicImage::ImageRgba8(img).write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png).unwrap();
            format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(buf))
        };
        // the third frame has another size and is scaled to the first
        let el = serde_json::json!({ "id": 1, "type": "image", "name": "a", "texturePath": "textures/ns/a",
            "size": [4, 3], "offset": [0, 0], "imageData": png(4, 3, 10),
            "animFrames": [png(4, 3, 10), png(4, 3, 20), png(8, 6, 30)], "animFrameSize": [4, 3], "animFps": 8 });
        let data = serde_json::json!({ "elements": [el], "namespace": "ns" });
        let view = ProjectView::new(&data);
        let files = build_pack_files(&view);
        let (_, bytes) = files.iter().find(|(p, _)| p == "textures/ns/a.png").expect("strip written");
        let img = image::load_from_memory(bytes).unwrap().to_rgba8();
        assert_eq!(img.dimensions(), (12, 3));
        assert_eq!(img.get_pixel(0, 0)[0], 10);
        assert_eq!(img.get_pixel(5, 1)[0], 20);
        assert_eq!(img.get_pixel(11, 2)[0], 30);
    }
}
