//! Persistent scanner & cache for plugin custom items and 3D models:
//! - ItemsAdder (`contents/<ns>/configs/**/*.yml` + resourcepack textures/models)
//! - Nexo / Oraxen (`items/**/*.yml` + `pack/assets/<ns>/...`)
//! - ModelEngine 4 & BetterModel (`*.bbmodel` blueprints / models)
//! - Multi-namespace Minecraft resource packs (`assets/<ns>/textures|models`)

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

pub struct CustomAssetsState {
    root: Mutex<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CustomSource {
    pub id: String,
    pub label: String,
    pub provider: String,
    pub path: String,
    pub item_count: usize,
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAssetItem {
    pub id: String,
    pub source_id: String,
    pub provider: String,
    pub kind: String, // "item" | "custom_model"
    pub name: String,
    pub namespace: String,
    #[serde(default)]
    pub animations: Vec<String>,
    #[serde(default)]
    pub has_model: bool,
    #[serde(default)]
    pub icon_file: Option<String>,
    #[serde(default)]
    pub model_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Catalog {
    sources: Vec<CustomSource>,
    items: Vec<CustomAssetItem>,
}

struct VirtualFile {
    path: String, // forward-slash normalized, lowercase matching helpers kept alongside original
    bytes: Vec<u8>,
}

struct Vfs {
    files: Vec<VirtualFile>,
    by_lower: HashMap<String, usize>,
}

impl Vfs {
    fn from_entries(entries: Vec<(String, Vec<u8>)>) -> Self {
        let mut files = Vec::with_capacity(entries.len());
        let mut by_lower = HashMap::with_capacity(entries.len());
        for (raw, bytes) in entries {
            let norm = raw.replace('\\', "/").trim_start_matches("./").to_string();
            let low = norm.to_ascii_lowercase();
            let idx = files.len();
            by_lower.insert(low, idx);
            files.push(VirtualFile { path: norm, bytes });
        }
        Self { files, by_lower }
    }

    fn get_suffix(&self, suffix: &str) -> Option<&VirtualFile> {
        let low = suffix.replace('\\', "/").trim_start_matches('/').to_ascii_lowercase();
        if let Some(&i) = self.by_lower.get(&low) {
            return Some(&self.files[i]);
        }
        let needle = format!("/{}", low);
        self.files
            .iter()
            .find(|f| f.path.to_ascii_lowercase().ends_with(&needle))
    }

    fn find_by_stem_in_ns(&self, ns: &str, stem: &str) -> Option<&VirtualFile> {
        let last = stem.rsplit('/').next().unwrap_or(stem);
        let clean_stem = last.strip_suffix(".png").unwrap_or(last).to_ascii_lowercase();
        if clean_stem.is_empty() {
            return None;
        }
        let target_end = format!("/{}.png", clean_stem);
        let ns_needle = if ns.is_empty() {
            String::new()
        } else {
            format!("/{}/textures/", ns.to_ascii_lowercase())
        };
        let ns_alt = if ns.is_empty() {
            String::new()
        } else {
            format!("assets/{}/textures/", ns.to_ascii_lowercase())
        };
        self.files.iter().find(|f| {
            let l = f.path.to_ascii_lowercase();
            l.ends_with(&target_end)
                && (ns.is_empty() || l.contains(&ns_needle) || l.contains(&ns_alt) || l.contains("/textures/"))
        })
    }

    fn text(&self, f: &VirtualFile) -> Option<String> {
        std::str::from_utf8(&f.bytes).ok().map(|s| s.to_string())
    }
}

impl CustomAssetsState {
    pub fn new(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(root.join("icons")).map_err(|e| e.to_string())?;
        fs::create_dir_all(root.join("models")).map_err(|e| e.to_string())?;
        Ok(Self { root: Mutex::new(root) })
    }

    fn root(&self) -> PathBuf {
        self.root.lock().unwrap().clone()
    }
}

fn safe_key(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect::<String>()
        .chars()
        .take(96)
        .collect()
}

fn read_catalog(root: &Path) -> Catalog {
    let p = root.join("catalog.json");
    let Ok(raw) = fs::read_to_string(&p) else {
        return Catalog::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_catalog(root: &Path, cat: &Catalog) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let p = root.join("catalog.json");
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(cat).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    fs::rename(&tmp, &p).map_err(|e| e.to_string())
}

fn clean_mc_text(s: &str) -> String {
    let mut out = String::new();
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if (c == '&' || c == '§') && i + 1 < chars.len() {
            i += 2;
            continue;
        }
        if c == '<' {
            if let Some(end) = chars[i..].iter().position(|&x| x == '>') {
                i += end + 1;
                continue;
            }
        }
        out.push(c);
        i += 1;
    }
    out.trim().to_string()
}

fn normalize_icon_png(raw_png: &[u8]) -> Option<Vec<u8>> {
    let img = image::load_from_memory(raw_png).ok()?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    if w == 0 || h == 0 {
        return None;
    }
    // Crop top frame if vertical animation sprite sheet (e.g. 16x64)
    let side = w.min(h);
    let cropped = if w != h {
        image::imageops::crop_imm(&rgba, 0, 0, side, side).to_image()
    } else {
        rgba
    };
    let final_img = if side > 64 {
        image::imageops::resize(&cropped, 64, 64, image::imageops::FilterType::Nearest)
    } else {
        cropped
    };
    let mut out = Vec::new();
    image::DynamicImage::ImageRgba8(final_img)
        .write_to(&mut Cursor::new(&mut out), image::ImageFormat::Png)
        .ok()?;
    Some(out)
}

fn save_icon_bytes(root: &Path, id: &str, png_bytes: &[u8]) -> Option<String> {
    let normalized = normalize_icon_png(png_bytes)?;
    let icons_dir = root.join("icons");
    let _ = fs::create_dir_all(&icons_dir);
    let fname = format!("{}.png", safe_key(id));
    fs::write(icons_dir.join(&fname), normalized).ok()?;
    Some(fname)
}

fn save_model_json(root: &Path, id: &str, val: &Value) -> Option<String> {
    let models_dir = root.join("models");
    let _ = fs::create_dir_all(&models_dir);
    let fname = format!("{}.json", safe_key(id));
    let bytes = serde_json::to_vec(val).ok()?;
    fs::write(models_dir.join(&fname), bytes).ok()?;
    Some(fname)
}

fn read_vfs_from_path(target: &Path) -> Result<(Vfs, String), String> {
    if !target.exists() {
        return Err(format!("Path not found: {}", target.display()));
    }
    let label = target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Custom Pack".into());

    let mut entries = Vec::new();
    if target.is_file() {
        let ext = target.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        if ext == "bbmodel" {
            let bytes = fs::read(target).map_err(|e| e.to_string())?;
            entries.push((label.clone(), bytes));
            return Ok((Vfs::from_entries(entries), label));
        }
        if ext == "zip" || ext == "jar" {
            let bytes = fs::read(target).map_err(|e| e.to_string())?;
            let mut z = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
            for i in 0..z.len() {
                let Ok(mut f) = z.by_index(i) else { continue };
                if f.is_dir() || f.size() > 16 * 1024 * 1024 {
                    continue;
                }
                let name = f.name().to_string();
                let lower = name.to_ascii_lowercase();
                if !(lower.ends_with(".yml")
                    || lower.ends_with(".yaml")
                    || lower.ends_with(".png")
                    || lower.ends_with(".json")
                    || lower.ends_with(".mcmeta")
                    || lower.ends_with(".bbmodel"))
                {
                    continue;
                }
                let mut buf = Vec::new();
                if f.read_to_end(&mut buf).is_ok() {
                    entries.push((name, buf));
                }
            }
            return Ok((Vfs::from_entries(entries), label));
        }
        return Err("Unsupported file type (expected .zip, .bbmodel, or folder)".into());
    }

    fn walk(base: &Path, dir: &Path, entries: &mut Vec<(String, Vec<u8>)>) {
        let Ok(rd) = fs::read_dir(dir) else { return };
        for ent in rd.flatten() {
            let p = ent.path();
            if p.is_dir() {
                let name = ent.file_name().to_string_lossy().to_ascii_lowercase();
                if name == ".git" || name == "node_modules" || name == "target" {
                    continue;
                }
                walk(base, &p, entries);
            } else if p.is_file() {
                let lower = p.file_name().map(|n| n.to_string_lossy().to_ascii_lowercase()).unwrap_or_default();
                if !(lower.ends_with(".yml")
                    || lower.ends_with(".yaml")
                    || lower.ends_with(".png")
                    || lower.ends_with(".json")
                    || lower.ends_with(".mcmeta")
                    || lower.ends_with(".bbmodel"))
                {
                    continue;
                }
                if let Ok(meta) = fs::metadata(&p) {
                    if meta.len() > 16 * 1024 * 1024 {
                        continue;
                    }
                }
                if let Ok(rel) = p.strip_prefix(base) {
                    if let Ok(bytes) = fs::read(&p) {
                        entries.push((rel.to_string_lossy().replace('\\', "/"), bytes));
                    }
                }
            }
        }
    }

    walk(target, target, &mut entries);
    Ok((Vfs::from_entries(entries), label))
}

fn find_texture_with_mcmeta<'a>(vfs: &'a Vfs, ns_hint: &str, tex_ref: &str) -> Option<(&'a [u8], Option<String>)> {
    let clean = tex_ref.trim().trim_start_matches('/').replace('\\', "/");
    if clean.is_empty() {
        return None;
    }
    let (ns, rel) = if let Some((a, b)) = clean.split_once(':') {
        (a.trim(), b.trim())
    } else {
        (ns_hint, clean.as_str())
    };
    let no_ext = rel.strip_suffix(".png").unwrap_or(rel);
    let mut candidates = Vec::new();
    if !ns.is_empty() {
        candidates.push(format!("assets/{}/textures/{}.png", ns, no_ext));
        candidates.push(format!("assets/{}/textures/item/{}.png", ns, no_ext));
        candidates.push(format!("assets/{}/textures/items/{}.png", ns, no_ext));
        candidates.push(format!("assets/{}/textures/block/{}.png", ns, no_ext));
        candidates.push(format!("assets/{}/textures/icons/{}.png", ns, no_ext));
        candidates.push(format!("assets/{}/textures/armor/{}.png", ns, no_ext));
        candidates.push(format!("resourcepack/assets/{}/textures/{}.png", ns, no_ext));
        candidates.push(format!("resourcepack/assets/{}/textures/item/{}.png", ns, no_ext));
        candidates.push(format!("contents/{}/resourcepack/{}/textures/{}.png", ns, ns, no_ext));
    }
    candidates.push(format!("{}.png", no_ext));
    candidates.push(format!("textures/{}.png", no_ext));
    candidates.push(format!("textures/item/{}.png", no_ext));
    let mut found_file: Option<&VirtualFile> = None;
    for c in candidates {
        if let Some(f) = vfs.get_suffix(&c) {
            found_file = Some(f);
            break;
        }
    }
    if found_file.is_none() {
        found_file = vfs.find_by_stem_in_ns(ns, no_ext);
    }
    let f = found_file?;
    let mcmeta_path = format!("{}.mcmeta", f.path);
    let mcmeta = vfs.get_suffix(&mcmeta_path).and_then(|mf| vfs.text(mf));
    Some((&f.bytes, mcmeta))
}

fn find_texture_png<'a>(vfs: &'a Vfs, ns_hint: &str, tex_ref: &str) -> Option<&'a [u8]> {
    find_texture_with_mcmeta(vfs, ns_hint, tex_ref).map(|(b, _)| b)
}

fn crop_animation_frame0(png_bytes: &[u8], mcmeta_json: Option<&str>) -> Vec<u8> {
    let Ok(img) = image::load_from_memory(png_bytes) else {
        return png_bytes.to_vec();
    };
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    if w == 0 || h == 0 {
        return png_bytes.to_vec();
    }
    let mut frame_w = w;
    let mut frame_h = w;
    let mut explicit_anim = false;
    if let Some(raw) = mcmeta_json {
        if let Ok(v) = serde_json::from_str::<Value>(raw) {
            if let Some(anim) = v.get("animation") {
                explicit_anim = true;
                if let Some(aw) = anim.get("width").and_then(|x| x.as_u64()) {
                    if aw > 0 && aw <= w as u64 { frame_w = aw as u32; }
                }
                if let Some(ah) = anim.get("height").and_then(|x| x.as_u64()) {
                    if ah > 0 && ah < h as u64 { frame_h = ah as u32; }
                }
            }
        }
    }
    let is_strip = h >= w * 2 && h % w == 0;
    if !explicit_anim && !is_strip {
        return png_bytes.to_vec();
    }
    if frame_h >= h && frame_w >= w {
        return png_bytes.to_vec();
    }
    let cw = frame_w.min(w);
    let ch = frame_h.min(h);
    let cropped = image::imageops::crop_imm(&rgba, 0, 0, cw, ch).to_image();
    let mut out = Vec::new();
    if image::DynamicImage::ImageRgba8(cropped)
        .write_to(&mut Cursor::new(&mut out), image::ImageFormat::Png)
        .is_ok()
    {
        return out;
    }
    png_bytes.to_vec()
}

fn extract_item_def_model_ref(v: &Value) -> Option<String> {
    if let Some(s) = v.as_str() {
        let clean = s.trim();
        if !clean.is_empty() { return Some(clean.to_string()); }
    }
    if let Some(s) = v.get("model").and_then(|m| m.as_str()) {
        let clean = s.trim();
        if !clean.is_empty() { return Some(clean.to_string()); }
    }
    for k in ["model", "fallback", "on_false", "on_true"] {
        if let Some(child) = v.get(k) {
            if let Some(r) = extract_item_def_model_ref(child) {
                return Some(r);
            }
        }
    }
    if let Some(cases) = v.get("cases").and_then(|c| c.as_array()) {
        for case in cases {
            if let Some(r) = extract_item_def_model_ref(case) {
                return Some(r);
            }
        }
    }
    if let Some(entries) = v.get("entries").and_then(|e| e.as_array()) {
        for ent in entries {
            if let Some(r) = extract_item_def_model_ref(ent) {
                return Some(r);
            }
        }
    }
    None
}

fn resolve_item_definition_model(vfs: &Vfs, ns: &str, id: &str) -> Option<String> {
    let clean_id = id.trim().strip_suffix(".json").unwrap_or(id.trim());
    let candidates = [
        format!("assets/{}/items/{}.json", ns, clean_id),
        format!("resourcepack/assets/{}/items/{}.json", ns, clean_id),
    ];
    for c in candidates {
        if let Some(f) = vfs.get_suffix(&c) {
            if let Some(txt) = vfs.text(f) {
                if let Ok(v) = serde_json::from_str::<Value>(&txt) {
                    if let Some(m) = extract_item_def_model_ref(&v) {
                        return Some(m);
                    }
                }
            }
        }
    }
    None
}

fn resolve_json_model_tree(vfs: &Vfs, ns_hint: &str, model_ref: &str) -> Option<Value> {
    let mut visited = 0;
    let mut merged_textures: BTreeMap<String, String> = BTreeMap::new();
    let mut final_elements: Option<Value> = None;
    let mut final_gui: Option<Value> = None;
    let mut cur_ref = Some(model_ref.trim().to_string());

    while let Some(r) = cur_ref.take() {
        if visited > 8 || r.is_empty() {
            break;
        }
        visited += 1;
        let (ns, rel) = if let Some((a, b)) = r.split_once(':') {
            (a.trim(), b.trim())
        } else {
            (ns_hint, r.as_str())
        };
        if ns == "minecraft" && (rel == "builtin/generated" || rel == "item/generated" || rel == "item/handheld") {
            break;
        }
        let no_ext = rel.strip_suffix(".json").unwrap_or(rel);
        let candidates = [
            format!("assets/{}/models/{}.json", ns, no_ext),
            format!("assets/{}/models/item/{}.json", ns, no_ext),
            format!("resourcepack/assets/{}/models/{}.json", ns, no_ext),
            format!("{}.json", no_ext),
        ];
        let mut parsed: Option<Value> = None;
        for c in candidates {
            if let Some(f) = vfs.get_suffix(&c) {
                if let Some(txt) = vfs.text(f) {
                    if let Ok(v) = serde_json::from_str::<Value>(&txt) {
                        parsed = Some(v);
                        break;
                    }
                }
            }
        }
        let Some(v) = parsed else { break };
        if let Some(texs) = v.get("textures").and_then(|t| t.as_object()) {
            for (k, val) in texs {
                if !merged_textures.contains_key(k) {
                    if let Some(s) = val.as_str() {
                        merged_textures.insert(k.clone(), s.to_string());
                    }
                }
            }
        }
        if final_elements.is_none() {
            if let Some(els) = v.get("elements") {
                if els.is_array() {
                    final_elements = Some(els.clone());
                }
            }
        }
        if final_gui.is_none() {
            if let Some(gui) = v.get("display").and_then(|d| d.get("gui")) {
                final_gui = Some(gui.clone());
            }
        }
        cur_ref = v.get("parent").and_then(|p| p.as_str()).map(|s| s.to_string());
    }

    // Resolve #ref chains and embed PNG data URLs
    let mut embedded_textures: BTreeMap<String, String> = BTreeMap::new();
    let mut first_tex_bytes: Option<Vec<u8>> = None;
    for (k, raw_v) in &merged_textures {
        let mut cur = raw_v.clone();
        let mut hops = 0;
        while cur.starts_with('#') && hops < 6 {
            hops += 1;
            if let Some(next) = merged_textures.get(&cur[1..]) {
                cur = next.clone();
            } else {
                break;
            }
        }
        if let Some((bytes, mcmeta)) = find_texture_with_mcmeta(vfs, ns_hint, &cur) {
            let clean_bytes = crop_animation_frame0(bytes, mcmeta.as_deref());
            if first_tex_bytes.is_none() {
                first_tex_bytes = Some(clean_bytes.clone());
            }
            let url = format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(&clean_bytes));
            embedded_textures.insert(k.clone(), url);
        }
    }

    if final_elements.is_none() && embedded_textures.is_empty() {
        return None;
    }

    let flat_b64 = if final_elements.is_none() {
        first_tex_bytes.map(|b| base64::engine::general_purpose::STANDARD.encode(b))
    } else {
        None
    };

    Some(json!({
        "kind": "mc_json",
        "elements": final_elements.unwrap_or(Value::Null),
        "textures": embedded_textures,
        "gui": final_gui.unwrap_or(Value::Null),
        "flatBytesB64": flat_b64
    }))
}

fn slug_id(raw: &str) -> String {
    let out: String = raw
        .to_ascii_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' })
        .collect();
    let trimmed = out.trim_matches('_').to_string();
    if trimmed.is_empty() { "model".into() } else { trimmed }
}

fn yaml_str<'a>(v: &'a serde_yaml::Value, keys: &[&str]) -> Option<&'a str> {
    for k in keys {
        if let Some(s) = v.get(*k).and_then(|x| x.as_str()) {
            if !s.trim().is_empty() {
                return Some(s.trim());
            }
        }
    }
    None
}

fn scan_bbmodels(
    root: &Path,
    vfs: &Vfs,
    source_id: &str,
    provider: &str,
    out_items: &mut Vec<CustomAssetItem>,
) {
    let prefix = if provider == "bettermodel" { "bm" } else { "meg" };
    for f in &vfs.files {
        if !f.path.to_ascii_lowercase().ends_with(".bbmodel") {
            continue;
        }
        let Some(txt) = vfs.text(f) else { continue };
        let Ok(bb) = serde_json::from_str::<Value>(&txt) else { continue };
        let fname_stem = Path::new(&f.path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "model".into());
        let id_slug = slug_id(&fname_stem);
        let item_id = format!("{}:{}", prefix, id_slug);
        let disp = bb
            .get("name")
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .unwrap_or(&fname_stem)
            .to_string();

        let animations: Vec<String> = bb
            .get("animations")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|x| x.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        // Compact model JSON keeping resolution, elements, outliner/groups hierarchy, and textures for GS.BbModel
        let compact = json!({
            "kind": "bbmodel",
            "name": disp,
            "resolution": bb.get("resolution").cloned().unwrap_or_else(|| json!({ "width": 16, "height": 16 })),
            "elements": bb.get("elements").cloned().unwrap_or_else(|| json!([])),
            "outliner": bb.get("outliner").cloned().unwrap_or_else(|| json!([])),
            "groups": bb.get("groups").cloned().unwrap_or(Value::Null),
            "textures": bb.get("textures").and_then(|t| t.as_array()).map(|arr| {
                arr.iter().map(|tx| json!({
                    "id": tx.get("id").cloned().unwrap_or(Value::Null),
                    "uuid": tx.get("uuid").cloned().unwrap_or(Value::Null),
                    "name": tx.get("name").cloned().unwrap_or(Value::Null),
                    "source": tx.get("source").cloned().unwrap_or(Value::Null),
                    "width": tx.get("width").cloned().unwrap_or(Value::Null),
                    "height": tx.get("height").cloned().unwrap_or(Value::Null),
                    "uv_width": tx.get("uv_width").cloned().unwrap_or(Value::Null),
                    "uv_height": tx.get("uv_height").cloned().unwrap_or(Value::Null),
                    "frame_time": tx.get("frame_time").cloned().unwrap_or(Value::Null),
                    "frame_height": tx.get("frame_height").cloned().unwrap_or(Value::Null),
                })).collect::<Vec<_>>()
            }).unwrap_or_else(Vec::new),
            "animations": animations,
        });

        let model_file = save_model_json(root, &item_id, &compact);
        out_items.push(CustomAssetItem {
            id: item_id,
            source_id: source_id.to_string(),
            provider: provider.to_string(),
            kind: "custom_model".into(),
            name: disp,
            namespace: prefix.to_string(),
            animations,
            has_model: model_file.is_some(),
            icon_file: None,
            model_file,
        });
    }
}

fn first_yaml_tex(node: &serde_yaml::Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(sub) = node.get(*k) {
            if let Some(s) = sub.as_str() {
                let t = s.trim();
                if !t.is_empty() { return Some(t.to_string()); }
            }
            if let Some(seq) = sub.as_sequence() {
                if let Some(s) = seq.first().and_then(|x| x.as_str()) {
                    let t = s.trim();
                    if !t.is_empty() { return Some(t.to_string()); }
                }
            }
            if let Some(map) = sub.as_mapping() {
                for tk in ["layer0", "all", "texture", "icon", "north", "front"] {
                    if let Some(s) = map.get(serde_yaml::Value::String(tk.into())).and_then(|x| x.as_str()) {
                        let t = s.trim();
                        if !t.is_empty() { return Some(t.to_string()); }
                    }
                }
                for (_, val) in map {
                    if let Some(s) = val.as_str() {
                        let t = s.trim();
                        if !t.is_empty() { return Some(t.to_string()); }
                    }
                }
            }
        }
    }
    None
}

fn scan_itemsadder(
    root: &Path,
    vfs: &Vfs,
    source_id: &str,
    out_items: &mut Vec<CustomAssetItem>,
) {
    for f in &vfs.files {
        let low = f.path.to_ascii_lowercase();
        if !(low.ends_with(".yml") || low.ends_with(".yaml")) {
            continue;
        }
        let Some(txt) = vfs.text(f) else { continue };
        let Ok(doc) = serde_yaml::from_str::<serde_yaml::Value>(&txt) else { continue };
        let ns = doc
            .get("info")
            .and_then(|i| i.get("namespace"))
            .and_then(|n| n.as_str())
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        if ns.is_empty() {
            continue;
        }
        let Some(items_map) = doc.get("items").and_then(|m| m.as_mapping()) else {
            continue;
        };
        for (k, val) in items_map {
            let Some(key) = k.as_str() else { continue };
            let key = key.trim();
            if key.is_empty() {
                continue;
            }
            let item_id = format!("ia:{}:{}", ns, key);
            let raw_name = yaml_str(val, &["display_name", "name"]).unwrap_or(key);
            let name = clean_mc_text(raw_name);

            let res = val.get("resource").unwrap_or(&serde_yaml::Value::Null);
            let gfx = val.get("graphics").unwrap_or(&serde_yaml::Value::Null);
            let armor_spec = val
                .get("specific_properties")
                .and_then(|sp| sp.get("armor"))
                .unwrap_or(&serde_yaml::Value::Null);

            let icon_ref = first_yaml_tex(gfx, &["icon", "texture", "textures"])
                .or_else(|| first_yaml_tex(res, &["texture", "textures"]))
                .or_else(|| first_yaml_tex(val, &["icon", "texture", "textures"]))
                .or_else(|| yaml_str(armor_spec, &["custom_armor"]).map(|s| format!("item/{}", key.trim_start_matches(s))));
            let model_ref = yaml_str(res, &["model_path"])
                .map(|s| s.to_string())
                .or_else(|| yaml_str(gfx, &["model"]).map(|s| s.to_string()))
                .or_else(|| gfx.get("models").and_then(|gm| yaml_str(gm, &["normal", "default"])).map(|s| s.to_string()))
                .or_else(|| yaml_str(val, &["item_model"]).map(|s| s.to_string()))
                .or_else(|| resolve_item_definition_model(vfs, &ns, key));

            let mut icon_file = icon_ref
                .as_deref()
                .and_then(|r| find_texture_png(vfs, &ns, r))
                .and_then(|b| save_icon_bytes(root, &item_id, b));

            let mut model_file = None;
            if let Some(mr) = model_ref {
                if let Some(tree) = resolve_json_model_tree(vfs, &ns, &mr) {
                    if icon_file.is_none() {
                        if let Some(b64) = tree.get("flatBytesB64").and_then(|v| v.as_str()) {
                            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
                                icon_file = save_icon_bytes(root, &item_id, &bytes);
                            }
                        }
                    }
                    if tree.get("elements").map(|e| e.is_array()).unwrap_or(false) {
                        model_file = save_model_json(root, &item_id, &tree);
                    }
                }
            }

            if icon_file.is_none() && model_file.is_none() {
                for probe in [
                    key.to_string(),
                    format!("item/{}", key),
                    format!("armor/{}", key),
                    format!("icons/{}", key),
                ] {
                    if let Some(b) = find_texture_png(vfs, &ns, &probe) {
                        icon_file = save_icon_bytes(root, &item_id, b);
                        if icon_file.is_some() { break; }
                    }
                }
            }

            out_items.push(CustomAssetItem {
                id: item_id,
                source_id: source_id.to_string(),
                provider: "itemsadder".into(),
                kind: "item".into(),
                name: if name.is_empty() { key.to_string() } else { name },
                namespace: ns.clone(),
                animations: Vec::new(),
                has_model: model_file.is_some(),
                icon_file,
                model_file,
            });
        }
    }
}

fn scan_nexo_or_oraxen(
    root: &Path,
    vfs: &Vfs,
    source_id: &str,
    provider: &str,
    out_items: &mut Vec<CustomAssetItem>,
) {
    let prefix = if provider == "oraxen" { "oraxen" } else { "nexo" };
    for f in &vfs.files {
        let low = f.path.to_ascii_lowercase();
        if !(low.ends_with(".yml") || low.ends_with(".yaml")) {
            continue;
        }
        // Skip files that look like ItemsAdder configs (info.namespace)
        let Some(txt) = vfs.text(f) else { continue };
        let Ok(doc) = serde_yaml::from_str::<serde_yaml::Value>(&txt) else { continue };
        if doc.get("info").and_then(|i| i.get("namespace")).is_some() {
            continue;
        }
        let Some(root_map) = doc.as_mapping() else { continue };
        for (k, val) in root_map {
            let Some(key) = k.as_str() else { continue };
            let key = key.trim();
            if key.is_empty() || !val.is_mapping() {
                continue;
            }
            // Must look like a Nexo/Oraxen item entry (has Pack or material or itemname/displayname)
            let pack = val.get("Pack").or_else(|| val.get("pack"));
            if pack.is_none() && val.get("material").is_none() && val.get("itemname").is_none() && val.get("displayname").is_none() {
                continue;
            }
            let item_id = format!("{}:{}", prefix, key);
            let raw_name = yaml_str(val, &["itemname", "displayname", "name"]).unwrap_or(key);
            let name = clean_mc_text(raw_name);

            let tex_ref = pack.and_then(|p| yaml_str(p, &["texture"]));
            let model_ref = pack.and_then(|p| yaml_str(p, &["model", "item_model"]));
            let ns_hint = model_ref
                .and_then(|m| m.split_once(':').map(|x| x.0))
                .or_else(|| tex_ref.and_then(|t| t.split_once(':').map(|x| x.0)))
                .unwrap_or(prefix);

            let mut icon_file = tex_ref
                .and_then(|r| find_texture_png(vfs, ns_hint, r))
                .and_then(|b| save_icon_bytes(root, &item_id, b));

            let mut model_file = None;
            if let Some(mr) = model_ref {
                if let Some(tree) = resolve_json_model_tree(vfs, ns_hint, mr) {
                    if icon_file.is_none() {
                        if let Some(b64) = tree.get("flatBytesB64").and_then(|v| v.as_str()) {
                            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
                                icon_file = save_icon_bytes(root, &item_id, &bytes);
                            }
                        }
                    }
                    if tree.get("elements").map(|e| e.is_array()).unwrap_or(false) {
                        model_file = save_model_json(root, &item_id, &tree);
                    }
                }
            }

            if icon_file.is_none() && model_file.is_none() {
                if let Some(b) = find_texture_png(vfs, ns_hint, key) {
                    icon_file = save_icon_bytes(root, &item_id, b);
                }
            }

            out_items.push(CustomAssetItem {
                id: item_id,
                source_id: source_id.to_string(),
                provider: provider.to_string(),
                kind: "item".into(),
                name: if name.is_empty() { key.to_string() } else { name },
                namespace: ns_hint.to_string(),
                animations: Vec::new(),
                has_model: model_file.is_some(),
                icon_file,
                model_file,
            });
        }
    }
}

fn detect_provider(vfs: &Vfs, path_str: &str, hint: Option<&str>) -> String {
    if let Some(h) = hint {
        let low = h.trim().to_ascii_lowercase();
        if ["itemsadder", "nexo", "oraxen", "craftengine", "modelengine", "bettermodel", "pack"].contains(&low.as_str()) {
            return low;
        }
    }
    let path_low = path_str.to_ascii_lowercase();
    let has_bb = vfs.files.iter().any(|f| f.path.to_ascii_lowercase().ends_with(".bbmodel"));
    if has_bb {
        if path_low.contains("bettermodel") {
            return "bettermodel".into();
        }
        return "modelengine".into();
    }
    if path_low.contains("craftengine")
        || vfs.files.iter().any(|f| {
            let l = f.path.to_ascii_lowercase();
            l == "pack.yml" || l.ends_with("/pack.yml") || l.contains("configuration/items")
        })
    {
        return "craftengine".into();
    }
    if path_low.contains("nexo") || vfs.files.iter().any(|f| f.path.to_ascii_lowercase().contains("pack/external_packs")) {
        return "nexo".into();
    }
    if path_low.contains("oraxen") {
        return "oraxen".into();
    }
    if path_low.contains("itemsadder") || vfs.files.iter().any(|f| f.path.to_ascii_lowercase().starts_with("contents/")) {
        return "itemsadder".into();
    }
    // Peek YAMLs for info.namespace (ItemsAdder) vs Pack: (Nexo)
    for f in &vfs.files {
        let low = f.path.to_ascii_lowercase();
        if !(low.ends_with(".yml") || low.ends_with(".yaml")) {
            continue;
        }
        if let Some(txt) = vfs.text(f) {
            if txt.contains("namespace:") && txt.contains("items:") {
                return "itemsadder".into();
            }
            if txt.contains("Pack:") || txt.contains("itemname:") {
                return "nexo".into();
            }
        }
    }
    "itemsadder".into()
}

fn scan_craftengine(
    root: &Path,
    vfs: &Vfs,
    source_id: &str,
    out_items: &mut Vec<CustomAssetItem>,
) {
    let mut pack_ns: Option<String> = None;
    for f in &vfs.files {
        let low = f.path.to_ascii_lowercase();
        if low == "pack.yml" || low.ends_with("/pack.yml") {
            if let Some(txt) = vfs.text(f) {
                if let Ok(doc) = serde_yaml::from_str::<serde_yaml::Value>(&txt) {
                    if let Some(ns) = doc.get("namespace").and_then(|v| v.as_str()) {
                        let clean = ns.trim();
                        if !clean.is_empty() {
                            pack_ns = Some(clean.to_string());
                            break;
                        }
                    }
                }
            }
        }
    }

    for f in &vfs.files {
        let low = f.path.to_ascii_lowercase();
        if !(low.ends_with(".yml") || low.ends_with(".yaml")) || low == "pack.yml" || low.ends_with("/pack.yml") {
            continue;
        }
        let Some(txt) = vfs.text(f) else { continue };
        let Ok(doc) = serde_yaml::from_str::<serde_yaml::Value>(&txt) else { continue };
        if doc.get("info").and_then(|i| i.get("namespace")).is_some() {
            continue;
        }
        let Some(items_map) = doc.get("items").and_then(|m| m.as_mapping()) else {
            continue;
        };
        let fallback_ns = pack_ns.as_deref().unwrap_or("craftengine");
        for (k, val) in items_map {
            let Some(raw_key) = k.as_str() else { continue };
            let raw_key = raw_key.trim();
            if raw_key.is_empty() {
                continue;
            }
            let (ns, raw_id) = if let Some((a, b)) = raw_key.split_once(':') {
                (a.trim(), b.trim())
            } else {
                (fallback_ns, raw_key)
            };
            if raw_id.is_empty() {
                continue;
            }
            let item_id = format!("craftengine:{}:{}", ns, raw_id);
            let data = val.get("data").unwrap_or(&serde_yaml::Value::Null);
            let raw_name = yaml_str(data, &["item-name", "custom-name", "display-name", "name"])
                .or_else(|| yaml_str(val, &["item-name", "custom-name", "display-name", "name"]))
                .unwrap_or(raw_id);
            let name = clean_mc_text(raw_name);

            let model_val = val.get("model");
            let model_str = model_val.and_then(|m| m.as_str()).or_else(|| model_val.and_then(|m| yaml_str(m, &["path"])));
            let tex_ref = yaml_str(val, &["texture"])
                .or_else(|| val.get("settings").and_then(|s| yaml_str(s, &["texture"])))
                .or_else(|| {
                    model_val
                        .and_then(|m| m.get("generation"))
                        .and_then(|g| g.get("textures"))
                        .and_then(|t| yaml_str(t, &["layer0", "all", "texture"]))
                })
                .or_else(|| model_val.and_then(|m| m.get("textures")).and_then(|t| yaml_str(t, &["layer0", "all", "texture"])));

            let mut icon_file = tex_ref
                .and_then(|r| find_texture_png(vfs, ns, r))
                .and_then(|b| save_icon_bytes(root, &item_id, b));

            let mut model_file = None;
            if let Some(mr) = model_str {
                if let Some(tree) = resolve_json_model_tree(vfs, ns, mr) {
                    if icon_file.is_none() {
                        if let Some(b64) = tree.get("flatBytesB64").and_then(|v| v.as_str()) {
                            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
                                icon_file = save_icon_bytes(root, &item_id, &bytes);
                            }
                        }
                    }
                    if tree.get("elements").map(|e| e.is_array()).unwrap_or(false) {
                        model_file = save_model_json(root, &item_id, &tree);
                    }
                }
            }

            if icon_file.is_none() && model_file.is_none() {
                if let Some(b) = find_texture_png(vfs, ns, raw_id) {
                    icon_file = save_icon_bytes(root, &item_id, b);
                }
            }

            out_items.push(CustomAssetItem {
                id: item_id,
                source_id: source_id.to_string(),
                provider: "craftengine".into(),
                kind: "item".into(),
                name: if name.is_empty() { raw_id.to_string() } else { name },
                namespace: ns.to_string(),
                animations: Vec::new(),
                has_model: model_file.is_some(),
                icon_file,
                model_file,
            });
        }
    }
}

pub fn scan_path(root: &Path, target: &Path, source_hint: Option<&str>) -> Result<Value, String> {
    let (vfs, label) = read_vfs_from_path(target)?;
    let abs = target.to_string_lossy().to_string();
    let provider = detect_provider(&vfs, &abs, source_hint);
    let source_id = format!("src_{}", safe_key(&format!("{}_{}", provider, abs)));

    let mut cat = read_catalog(root);
    // Remove previous items from same source_id cleanly before re-scanning
    let old_items: Vec<CustomAssetItem> = cat.items.iter().filter(|x| x.source_id == source_id).cloned().collect();
    for old in &old_items {
        if let Some(ic) = &old.icon_file {
            let _ = fs::remove_file(root.join("icons").join(ic));
        }
        if let Some(md) = &old.model_file {
            let _ = fs::remove_file(root.join("models").join(md));
        }
    }
    cat.items.retain(|x| x.source_id != source_id);
    cat.sources.retain(|s| s.id != source_id);

    let mut found: Vec<CustomAssetItem> = Vec::new();
    match provider.as_str() {
        "modelengine" | "bettermodel" => scan_bbmodels(root, &vfs, &source_id, &provider, &mut found),
        "craftengine" => {
            scan_craftengine(root, &vfs, &source_id, &mut found);
            scan_bbmodels(root, &vfs, &source_id, "modelengine", &mut found);
        }
        "nexo" | "oraxen" => {
            scan_nexo_or_oraxen(root, &vfs, &source_id, &provider, &mut found);
            // Also pick up any bundled .bbmodel inside folder
            scan_bbmodels(root, &vfs, &source_id, "modelengine", &mut found);
        }
        _ => {
            scan_itemsadder(root, &vfs, &source_id, &mut found);
            // Fallback in case user picked a raw pack or mixed folder
            if found.is_empty() {
                scan_craftengine(root, &vfs, &source_id, &mut found);
            }
            if found.is_empty() {
                scan_nexo_or_oraxen(root, &vfs, &source_id, "nexo", &mut found);
                scan_bbmodels(root, &vfs, &source_id, "modelengine", &mut found);
            }
        }
    }

    // Deduplicate by item id
    let mut seen = std::collections::HashSet::new();
    found.retain(|item| seen.insert(item.id.clone()));
    let ids_new: std::collections::HashSet<String> = found.iter().map(|i| i.id.clone()).collect();
    cat.items.retain(|old| !ids_new.contains(&old.id));

    let count = found.len();
    cat.sources.push(CustomSource {
        id: source_id.clone(),
        label: label.clone(),
        provider: provider.clone(),
        path: abs,
        item_count: count,
        imported_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
    });
    cat.items.extend(found);
    write_catalog(root, &cat)?;

    Ok(json!({
        "sourceId": source_id,
        "label": label,
        "provider": provider,
        "count": count,
    }))
}

#[tauri::command]
pub fn custom_assets_list(state: State<CustomAssetsState>) -> Result<Value, String> {
    let root = state.root();
    let cat = read_catalog(&root);
    let icons_dir = root.join("icons");
    let enriched: Vec<Value> = cat
        .items
        .into_iter()
        .map(|it| {
            let icon_data_url = it.icon_file.as_ref().and_then(|f| {
                fs::read(icons_dir.join(f)).ok().map(|b| {
                    format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(b))
                })
            });
            json!({
                "id": it.id,
                "sourceId": it.source_id,
                "provider": it.provider,
                "kind": it.kind,
                "name": it.name,
                "namespace": it.namespace,
                "animations": it.animations,
                "hasModel": it.has_model,
                "iconDataUrl": icon_data_url,
            })
        })
        .collect();
    Ok(json!({
        "sources": cat.sources,
        "items": enriched,
    }))
}

#[tauri::command]
pub fn custom_assets_get_model(state: State<CustomAssetsState>, item_id: String) -> Result<Value, String> {
    let root = state.root();
    let cat = read_catalog(&root);
    let item = cat
        .items
        .into_iter()
        .find(|x| x.id.eq_ignore_ascii_case(&item_id))
        .ok_or_else(|| format!("Custom model not found: {}", item_id))?;
    let fname = item.model_file.ok_or("Item has no 3D model geometry cached")?;
    let raw = fs::read_to_string(root.join("models").join(fname)).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn custom_assets_save_icon(
    state: State<CustomAssetsState>,
    item_id: String,
    data_url: String,
) -> Result<Value, String> {
    let root = state.root();
    let b64 = data_url
        .split_once(',')
        .map(|x| x.1)
        .unwrap_or(data_url.as_str());
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| format!("Invalid PNG base64: {}", e))?;
    let fname = save_icon_bytes(&root, &item_id, &bytes).ok_or("Could not save PNG icon")?;
    let mut cat = read_catalog(&root);
    if let Some(it) = cat.items.iter_mut().find(|x| x.id.eq_ignore_ascii_case(&item_id)) {
        it.icon_file = Some(fname.clone());
        write_catalog(&root, &cat)?;
    }
    Ok(json!({ "ok": true, "iconFile": fname }))
}

#[tauri::command]
pub fn custom_assets_scan_path(
    state: State<CustomAssetsState>,
    path: String,
    source_hint: Option<String>,
) -> Result<Value, String> {
    let root = state.root();
    scan_path(&root, Path::new(&path), source_hint.as_deref())
}

#[tauri::command]
pub async fn custom_assets_pick_and_import(
    app: tauri::AppHandle,
    state: State<'_, CustomAssetsState>,
    folder: bool,
    source_hint: Option<String>,
) -> Result<Option<Value>, String> {
    let title = if folder {
        "Select plugin pack folder (ItemsAdder / Nexo / CraftEngine / ModelEngine / BetterModel)"
    } else {
        "Select resource pack .zip or .bbmodel file"
    };
    let dialog = app.dialog().file().set_title(title);
    let picked = if folder {
        dialog.blocking_pick_folder()
    } else {
        dialog
            .add_filter("Pack or Model", &["zip", "bbmodel"])
            .blocking_pick_file()
    };
    let Some(picked) = picked else {
        return Ok(None);
    };
    let target = picked.into_path().map_err(|e| e.to_string())?;
    let root = state.root();
    let res = tauri::async_runtime::spawn_blocking(move || scan_path(&root, &target, source_hint.as_deref()))
        .await
        .map_err(|e| e.to_string())??;
    Ok(Some(res))
}

#[tauri::command]
pub fn custom_assets_clear_model_icons(state: State<CustomAssetsState>) -> Result<Value, String> {
    let root = state.root();
    let mut cat = read_catalog(&root);
    let mut cleared = 0usize;
    for it in cat.items.iter_mut() {
        if it.has_model {
            if let Some(ic) = it.icon_file.take() {
                let _ = fs::remove_file(root.join("icons").join(ic));
                cleared += 1;
            }
        }
    }
    if cleared > 0 {
        write_catalog(&root, &cat)?;
    }
    Ok(json!({ "ok": true, "cleared": cleared }))
}

#[tauri::command]
pub fn custom_assets_remove_source(
    state: State<CustomAssetsState>,
    source_id: String,
) -> Result<Value, String> {
    let root = state.root();
    let mut cat = read_catalog(&root);
    for it in cat.items.iter().filter(|x| x.source_id == source_id) {
        if let Some(ic) = &it.icon_file {
            let _ = fs::remove_file(root.join("icons").join(ic));
        }
        if let Some(md) = &it.model_file {
            let _ = fs::remove_file(root.join("models").join(md));
        }
    }
    cat.items.retain(|x| x.source_id != source_id);
    cat.sources.retain(|s| s.id != source_id);
    write_catalog(&root, &cat)?;
    Ok(json!({ "ok": true, "sourcesRemaining": cat.sources.len() }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_png() -> Vec<u8> {
        let img = image::RgbaImage::from_pixel(16, 16, image::Rgba([220, 60, 80, 255]));
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
            .unwrap();
        buf
    }

    #[test]
    fn scans_itemsadder_nexo_and_bbmodel_packs() {
        let tmp = std::env::temp_dir().join(format!("kz_custom_assets_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        let cache = tmp.join("cache");
        let ia_dir = tmp.join("ItemsAdder");
        fs::create_dir_all(ia_dir.join("contents/fantasy/configs")).unwrap();
        fs::create_dir_all(ia_dir.join("contents/fantasy/resourcepack/assets/fantasy/textures/item")).unwrap();
        fs::write(
            ia_dir.join("contents/fantasy/configs/weapons.yml"),
            "info:\n  namespace: fantasy\nitems:\n  ruby_blade:\n    display_name: '&cRuby Blade'\n    resource:\n      material: DIAMOND_SWORD\n      texture: item/ruby_blade\n",
        )
        .unwrap();
        fs::write(
            ia_dir.join("contents/fantasy/resourcepack/assets/fantasy/textures/item/ruby_blade.png"),
            tiny_png(),
        )
        .unwrap();

        let ia_res = scan_path(&cache, &ia_dir, None).unwrap();
        assert_eq!(ia_res["provider"], "itemsadder");
        assert_eq!(ia_res["count"], 1);

        let nexo_dir = tmp.join("Nexo");
        fs::create_dir_all(nexo_dir.join("items")).unwrap();
        fs::create_dir_all(nexo_dir.join("pack/assets/myserver/textures/item")).unwrap();
        fs::write(
            nexo_dir.join("items/swords.yml"),
            "emerald_edge:\n  itemname: '<green>Emerald Edge'\n  material: NETHERITE_SWORD\n  Pack:\n    texture: myserver:item/emerald_edge\n",
        )
        .unwrap();
        fs::write(
            nexo_dir.join("pack/assets/myserver/textures/item/emerald_edge.png"),
            tiny_png(),
        )
        .unwrap();

        let nx_res = scan_path(&cache, &nexo_dir, None).unwrap();
        assert_eq!(nx_res["provider"], "nexo");
        assert_eq!(nx_res["count"], 1);

        let meg_dir = tmp.join("ModelEngine/blueprints");
        fs::create_dir_all(&meg_dir).unwrap();
        fs::write(
            meg_dir.join("dragon_pet.bbmodel"),
            json!({
                "name": "Dragon Pet",
                "resolution": { "width": 32, "height": 32 },
                "elements": [{ "from": [0, 0, 0], "to": [16, 16, 16], "faces": {} }],
                "textures": [],
                "animations": [{ "name": "idle" }, { "name": "fly" }]
            })
            .to_string(),
        )
        .unwrap();

        let meg_res = scan_path(&cache, &meg_dir, None).unwrap();
        assert_eq!(meg_res["provider"], "modelengine");
        assert_eq!(meg_res["count"], 1);

        let cat = read_catalog(&cache);
        assert_eq!(cat.sources.len(), 3);
        assert_eq!(cat.items.len(), 3);
        let ia_item = cat.items.iter().find(|i| i.id == "ia:fantasy:ruby_blade").unwrap();
        assert_eq!(ia_item.name, "Ruby Blade");
        assert!(ia_item.icon_file.is_some());
        let nx_item = cat.items.iter().find(|i| i.id == "nexo:emerald_edge").unwrap();
        assert_eq!(nx_item.name, "Emerald Edge");
        assert!(nx_item.icon_file.is_some());
        let meg_item = cat.items.iter().find(|i| i.id == "meg:dragon_pet").unwrap();
        assert_eq!(meg_item.animations, vec!["idle", "fly"]);
        assert!(meg_item.has_model);

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn scans_craftengine_pack() {
        let tmp = std::env::temp_dir().join(format!("kz_craftengine_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        let cache = tmp.join("cache");
        let ce_dir = tmp.join("CraftEngine/resources/my_pack");
        fs::create_dir_all(ce_dir.join("configuration/items")).unwrap();
        fs::create_dir_all(ce_dir.join("resourcepack/assets/my_pack/textures/item")).unwrap();
        fs::write(
            ce_dir.join("pack.yml"),
            "author: Tester\nversion: 1.0.0\nnamespace: my_pack\nenable: true\n",
        )
        .unwrap();
        fs::write(
            ce_dir.join("configuration/items/weapons.yml"),
            "items:\n  my_pack:frost_blade:\n    material: DIAMOND_SWORD\n    data:\n      item-name: '<aqua>Frost Blade'\n    model:\n      type: minecraft:model\n      generation:\n        parent: minecraft:item/handheld\n        textures:\n          layer0: my_pack:item/frost_blade\n",
        )
        .unwrap();
        fs::write(
            ce_dir.join("resourcepack/assets/my_pack/textures/item/frost_blade.png"),
            tiny_png(),
        )
        .unwrap();

        let res = scan_path(&cache, &ce_dir, None).unwrap();
        assert_eq!(res["provider"], "craftengine");
        assert_eq!(res["count"], 1);
        let cat = read_catalog(&cache);
        let ce_item = cat.items.iter().find(|i| i.id == "craftengine:my_pack:frost_blade").unwrap();
        assert_eq!(ce_item.name, "Frost Blade");
        assert!(ce_item.icon_file.is_some());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn crops_mcmeta_strip_preserves_outliner_and_handles_ia_item_defs() {
        let tmp = std::env::temp_dir().join(format!("kz_3d_upgrade_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        let cache = tmp.join("cache");

        // 1. Animated 16x96 strip + .mcmeta + 1.21.4 items/*.json + resource.textures list
        let ia_dir = tmp.join("ItemsAdder");
        fs::create_dir_all(ia_dir.join("contents/wings/configs")).unwrap();
        fs::create_dir_all(ia_dir.join("contents/wings/resourcepack/assets/wings/items")).unwrap();
        fs::create_dir_all(ia_dir.join("contents/wings/resourcepack/assets/wings/models/item")).unwrap();
        fs::create_dir_all(ia_dir.join("contents/wings/resourcepack/assets/wings/textures/item")).unwrap();
        fs::write(
            ia_dir.join("contents/wings/configs/items.yml"),
            "info:\n  namespace: wings\nitems:\n  seraph_wing:\n    display_name: '&6Seraph Wing'\n  ruby_helm:\n    display_name: '&cRuby Helm'\n    resource:\n      textures:\n        - item/ruby_helm\n",
        )
        .unwrap();
        fs::write(
            ia_dir.join("contents/wings/resourcepack/assets/wings/items/seraph_wing.json"),
            json!({ "model": { "type": "minecraft:model", "model": "wings:item/seraph_wing" } }).to_string(),
        )
        .unwrap();
        fs::write(
            ia_dir.join("contents/wings/resourcepack/assets/wings/models/item/seraph_wing.json"),
            json!({
                "textures": { "0": "wings:item/seraph_strip" },
                "display": { "gui": { "rotation": [15, -35, 0], "scale": [0.7, 0.7, 0.7] } },
                "elements": [{ "from": [0, 0, 7], "to": [16, 16, 8], "faces": { "north": { "uv": [0, 0, 16, 16], "texture": "#0" } } }]
            })
            .to_string(),
        )
        .unwrap();

        let strip = image::RgbaImage::from_pixel(16, 96, image::Rgba([40, 200, 255, 255]));
        let mut strip_buf = Vec::new();
        image::DynamicImage::ImageRgba8(strip)
            .write_to(&mut Cursor::new(&mut strip_buf), image::ImageFormat::Png)
            .unwrap();
        fs::write(
            ia_dir.join("contents/wings/resourcepack/assets/wings/textures/item/seraph_strip.png"),
            strip_buf,
        )
        .unwrap();
        fs::write(
            ia_dir.join("contents/wings/resourcepack/assets/wings/textures/item/seraph_strip.png.mcmeta"),
            "{\"animation\":{\"frametime\":2}}",
        )
        .unwrap();
        fs::write(
            ia_dir.join("contents/wings/resourcepack/assets/wings/textures/item/ruby_helm.png"),
            tiny_png(),
        )
        .unwrap();

        let ia_res = scan_path(&cache, &ia_dir, None).unwrap();
        assert_eq!(ia_res["count"], 2);
        let cat = read_catalog(&cache);
        let wing = cat.items.iter().find(|i| i.id == "ia:wings:seraph_wing").unwrap();
        assert!(wing.has_model);
        let helm = cat.items.iter().find(|i| i.id == "ia:wings:ruby_helm").unwrap();
        assert!(helm.icon_file.is_some());

        let wing_raw = fs::read_to_string(cache.join("models").join(wing.model_file.as_ref().unwrap())).unwrap();
        let wing_json: Value = serde_json::from_str(&wing_raw).unwrap();
        let tex_b64 = wing_json["textures"]["0"].as_str().unwrap().split_once(',').unwrap().1;
        let tex_bytes = base64::engine::general_purpose::STANDARD.decode(tex_b64).unwrap();
        let decoded = image::load_from_memory(&tex_bytes).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (16, 16));

        // 2. Blockbench .bbmodel outliner & groups preservation
        let bb_dir = tmp.join("ModelEngine/blueprints");
        fs::create_dir_all(&bb_dir).unwrap();
        fs::write(
            bb_dir.join("wraith.bbmodel"),
            json!({
                "name": "Wraith",
                "resolution": { "width": 64, "height": 64 },
                "elements": [{ "uuid": "c1", "name": "body", "from": [-4, 0, -4], "to": [4, 16, 4], "faces": {} }],
                "outliner": [{ "name": "root", "uuid": "g1", "origin": [0, 8, 0], "rotation": [10, 20, 0], "children": ["c1"] }],
                "groups": [{ "name": "root", "uuid": "g1", "origin": [0, 8, 0], "rotation": [10, 20, 0] }],
                "textures": []
            })
            .to_string(),
        )
        .unwrap();
        scan_path(&cache, &bb_dir, None).unwrap();
        let cat2 = read_catalog(&cache);
        let wraith = cat2.items.iter().find(|i| i.id == "meg:wraith").unwrap();
        let wr_raw = fs::read_to_string(cache.join("models").join(wraith.model_file.as_ref().unwrap())).unwrap();
        let wr_json: Value = serde_json::from_str(&wr_raw).unwrap();
        assert!(wr_json["outliner"].is_array() && wr_json["outliner"].as_array().unwrap().len() == 1);
        assert!(wr_json["groups"].is_array());

        let _ = fs::remove_dir_all(&tmp);
    }
}
