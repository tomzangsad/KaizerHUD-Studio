//! Java HUD pack importer.
//!
//! Reads a purchased Java-edition HUD pack (a .zip or an extracted folder),
//! finds every BetterHud / HappyHUD / MythicHUD config root inside it, and turns
//! each HUD into a plugin-neutral list of elements the editor can create:
//! images, bars, texts and heads, already converted to Bedrock-style
//! anchor + offset (GUI pixels, y down).
//!
//! Packs differ a lot and are often a bit broken, so nothing here fails hard:
//! anything that can't be understood becomes a warning on the element / HUD.

use base64::Engine;
use indexmap::IndexMap;
use serde_json::{json, Value as J};
use serde_yaml::Value as Y;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::io::Read;
use std::path::Path;

/// Reference GUI screen used to turn non 0/50/100 percentages into pixels and
/// for the import preview (1920×1080 at GUI scale 4).
pub const REF_W: f64 = 480.0;
pub const REF_H: f64 = 270.0;
/// The editor (and Bedrock) draws the 182×22 hotbar 2px above the bottom edge;
/// Java draws it on the edge. Values are y-down from the bottom edge.
const HOTBAR_LIFT: f64 = -2.0;
const HOTBAR_MID: f64 = HOTBAR_LIFT - 11.0;

const MAX_TOTAL_BYTES: u64 = 512 * 1024 * 1024;
const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_FILES: usize = 40_000;

/* ───────────────────────── virtual file system ───────────────────────── */

pub struct Vfs {
    files: BTreeMap<String, Vec<u8>>,
    /// lowercase path → real path
    lower: HashMap<String, String>,
    /// squashed file stem (lowercase, no `_ - space`, no extension) → real paths
    stems: HashMap<String, Vec<String>>,
    total: u64,
}

fn wanted(path: &str) -> bool {
    let l = path.to_ascii_lowercase();
    let is_font_json = l.ends_with(".json") && (l.contains("/font/") || l.starts_with("font/"));
    if !(l.ends_with(".yml") || l.ends_with(".yaml") || l.ends_with(".png") || l.ends_with(".zip") || is_font_json) {
        return false;
    }
    // caches / generated output the plugins write next to their config (Nexo `.assetCache`,
    // `.deobfCachedPacks`, ItemsAdder `output/` + `storage/`, BetterHud `build/` + `.libraries`):
    // copies of the real files that only add duplicate hotbars and memory use
    let segs: Vec<&str> = l.split('/').collect();
    let dirs = &segs[..segs.len().saturating_sub(1)];
    if dirs.iter().any(|s| s.starts_with('.') && s.len() > 1) {
        return false;
    }
    !dirs.windows(2).any(|w| {
        (w[0] == "itemsadder" && (w[1] == "output" || w[1] == "storage"))
            || (w[0] == "betterhud" && w[1] == "build")
    })
}

fn squash(s: &str) -> String {
    s.chars()
        .filter(|c| !matches!(c, '_' | '-' | ' ' | '.'))
        .flat_map(|c| c.to_lowercase())
        .collect()
}

fn stem_of(path: &str) -> String {
    let name = path.rsplit('/').next().unwrap_or(path);
    let name = match name.rfind('.') {
        Some(i) if name[i..].eq_ignore_ascii_case(".png") => &name[..i],
        _ => name,
    };
    squash(name)
}

impl Vfs {
    fn new() -> Self {
        Vfs { files: BTreeMap::new(), lower: HashMap::new(), stems: HashMap::new(), total: 0 }
    }

    pub fn load(path: &Path) -> Result<Self, String> {
        let mut vfs = Vfs::new();
        if path.is_dir() {
            vfs.add_dir(path, path)?;
        } else {
            let bytes = std::fs::read(path).map_err(|e| format!("Could not read {}: {}", path.display(), e))?;
            vfs.add_zip(&bytes, "", 0)?;
        }
        vfs.index();
        if vfs.files.is_empty() {
            return Err("No YAML or PNG files were found in this pack".into());
        }
        Ok(vfs)
    }

    fn insert(&mut self, path: String, data: Vec<u8>) -> Result<(), String> {
        self.total += data.len() as u64;
        if self.total > MAX_TOTAL_BYTES || self.files.len() >= MAX_FILES {
            return Err("The pack is too large to import".into());
        }
        if path.to_ascii_lowercase().ends_with(".zip") {
            // nested archives (e.g. a resource pack zip inside the pack)
            let prefix = format!("{}/", &path[..path.len() - 4]);
            let _ = self.add_zip(&data, &prefix, 1);
            return Ok(());
        }
        self.files.insert(path, data);
        Ok(())
    }

    fn add_dir(&mut self, base: &Path, dir: &Path) -> Result<(), String> {
        let rd = std::fs::read_dir(dir).map_err(|e| format!("Could not read {}: {}", dir.display(), e))?;
        for entry in rd.flatten() {
            let p = entry.path();
            let Ok(ft) = entry.file_type() else { continue };
            if ft.is_symlink() {
                continue;
            }
            if ft.is_dir() {
                self.add_dir(base, &p)?;
            } else if ft.is_file() {
                let rel = p.strip_prefix(base).unwrap_or(&p).to_string_lossy().replace('\\', "/");
                if !wanted(&rel) {
                    continue;
                }
                let len = entry.metadata().map(|m| m.len()).unwrap_or(0);
                if len > MAX_FILE_BYTES {
                    continue;
                }
                if let Ok(data) = std::fs::read(&p) {
                    self.insert(rel, data)?;
                }
            }
        }
        Ok(())
    }

    fn add_zip(&mut self, bytes: &[u8], prefix: &str, depth: u32) -> Result<(), String> {
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes))
            .map_err(|e| format!("Not a valid zip file: {}", e))?;
        for i in 0..zip.len() {
            let Ok(mut f) = zip.by_index(i) else { continue };
            if f.is_dir() {
                continue;
            }
            let Some(name) = f.enclosed_name() else { continue };
            let rel = format!("{}{}", prefix, name.to_string_lossy().replace('\\', "/"));
            if !wanted(&rel) || f.size() > MAX_FILE_BYTES {
                continue;
            }
            if rel.to_ascii_lowercase().ends_with(".zip") && depth >= 1 {
                continue;
            }
            let mut data = Vec::with_capacity(f.size() as usize);
            if f.read_to_end(&mut data).is_err() {
                continue;
            }
            self.insert(rel, data)?;
        }
        Ok(())
    }

    fn index(&mut self) {
        for k in self.files.keys() {
            self.lower.insert(k.to_ascii_lowercase(), k.clone());
            if k.to_ascii_lowercase().ends_with(".png") {
                self.stems.entry(stem_of(k)).or_default().push(k.clone());
            }
        }
    }

    pub fn get(&self, path: &str) -> Option<&Vec<u8>> {
        self.files.get(path)
    }

    /// Files under `dir/` (recursive), in path order
    fn under<'a>(&'a self, dir: &str) -> impl Iterator<Item = (&'a String, &'a Vec<u8>)> + 'a {
        let prefix = dir.to_string();
        self.files
            .range(prefix.clone()..)
            .take_while(move |(k, _)| k.starts_with(&prefix))
    }

    fn has_yaml_under(&self, dir: &str) -> bool {
        self.under(dir).any(|(k, _)| is_yaml(k))
    }

    /// Finds a PNG, forgiving case, missing `.png`, and `_`/`-` differences.
    /// `bases` are tried in order; the last resort is a unique stem match anywhere.
    fn resolve_png(&self, bases: &[String], rel: &str) -> Option<String> {
        let rel = rel.trim().trim_start_matches("./").replace('\\', "/");
        if rel.is_empty() {
            return None;
        }
        let with_ext = if rel.to_ascii_lowercase().ends_with(".png") { rel.clone() } else { format!("{}.png", rel) };
        for b in bases {
            for cand in [format!("{}{}", b, with_ext), format!("{}{}", b, rel)] {
                if self.files.contains_key(&cand) {
                    return Some(cand);
                }
                if let Some(real) = self.lower.get(&cand.to_ascii_lowercase()) {
                    return Some(real.clone());
                }
            }
        }
        // same folder, squashed name
        let want = stem_of(&with_ext);
        let dir_part = match with_ext.rfind('/') {
            Some(i) => with_ext[..=i].to_ascii_lowercase(),
            None => String::new(),
        };
        let hits = self.stems.get(&want)?;
        for b in bases {
            let d = format!("{}{}", b, dir_part).to_ascii_lowercase();
            if let Some(h) = hits.iter().find(|h| h.to_ascii_lowercase().starts_with(&d)) {
                return Some(h.clone());
            }
        }
        for b in bases {
            if let Some(h) = hits.iter().find(|h| h.starts_with(b.as_str())) {
                return Some(h.clone());
            }
        }
        if hits.len() == 1 {
            return Some(hits[0].clone());
        }
        None
    }
}

fn is_yaml(p: &str) -> bool {
    let l = p.to_ascii_lowercase();
    l.ends_with(".yml") || l.ends_with(".yaml")
}

/* ───────────────────────── YAML helpers ───────────────────────── */

fn parse_yaml(bytes: &[u8]) -> Result<Y, String> {
    parse_yaml_noted(bytes).map(|(y, _)| y)
}

/// Parses YAML; the flag says duplicate keys had to be dropped first.
/// The plugins read their files with SnakeYAML, which accepts a key twice and keeps the
/// last one — packs rely on that (Fantasy HUD has `34:` twice in one layout), while
/// serde_yaml refuses the whole file.
fn parse_yaml_noted(bytes: &[u8]) -> Result<(Y, bool), String> {
    let text = String::from_utf8_lossy(bytes);
    let text = text.trim_start_matches('\u{feff}').replace('\t', "  ");
    match serde_yaml::from_str::<Y>(&text) {
        Ok(y) => Ok((y, false)),
        Err(e) if e.to_string().contains("duplicate") => {
            let fixed = drop_duplicate_keys(&text);
            serde_yaml::from_str::<Y>(&fixed).map(|y| (y, true)).map_err(|e2| e2.to_string())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Key of a block-mapping line (`key:` / `key: value` / `'key': v`), if the line is one
fn yaml_line_key(body: &str) -> Option<String> {
    if body.starts_with('#') || body.starts_with('-') || body.starts_with('{') || body.starts_with('[') {
        return None;
    }
    let (key, rest) = if let Some(q) = body.chars().next().filter(|c| *c == '\'' || *c == '"') {
        let end = body[1..].find(q)? + 1;
        (body[1..end].to_string(), &body[end + 1..])
    } else {
        let mut cut = None;
        for (i, ch) in body.char_indices() {
            if ch == ':' && body[i + 1..].chars().next().map_or(true, |n| n == ' ') {
                cut = Some(i);
                break;
            }
            if ch == '#' && i > 0 && body[..i].ends_with(' ') {
                break;
            }
        }
        let i = cut?;
        (body[..i].trim().to_string(), &body[i..])
    };
    if !rest.trim_start().starts_with(':') {
        return None;
    }
    Some(key)
}

/// Removes every earlier copy of a key that appears twice in the same block mapping
/// (later wins, like SnakeYAML). Only used after serde_yaml rejected the file.
fn drop_duplicate_keys(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let indent_of = |l: &str| l.len() - l.trim_start_matches(' ').len();
    let is_content = |l: &str| {
        let t = l.trim();
        !t.is_empty() && !t.starts_with('#')
    };
    // end (exclusive) of the block that starts with the key line at `i`
    let block_end = |i: usize| {
        let ind = indent_of(lines[i]);
        let mut j = i + 1;
        while j < lines.len() {
            let l = lines[j];
            if is_content(l) {
                let li = indent_of(l);
                // `key:` followed by `- item` at the same indent still belongs to the key
                if li < ind || (li == ind && !l.trim_start().starts_with('-')) {
                    break;
                }
            }
            j += 1;
        }
        j
    };
    let mut drop = vec![false; lines.len()];
    // stack of (indent, parent id); parent id = line index of the owning key (usize::MAX = root)
    let mut stack: Vec<(usize, usize)> = vec![];
    let mut seen: HashMap<(usize, String), usize> = HashMap::new();
    for i in 0..lines.len() {
        let l = lines[i];
        if !is_content(l) {
            continue;
        }
        let ind = indent_of(l);
        let body = l.trim_start();
        while stack.last().map_or(false, |(si, _)| *si >= ind) {
            stack.pop();
        }
        if body.starts_with("- ") || body == "-" {
            // a list item: anything inside it is a new mapping
            stack.push((ind, i));
            continue;
        }
        let Some(key) = yaml_line_key(body) else { continue };
        let parent = stack.last().map(|(_, p)| *p).unwrap_or(usize::MAX);
        if let Some(prev) = seen.insert((parent, key), i) {
            for d in drop.iter_mut().take(block_end(prev)).skip(prev) {
                *d = true;
            }
        }
        stack.push((ind, i));
    }
    lines
        .iter()
        .zip(drop)
        .filter(|(_, d)| !d)
        .map(|(l, _)| *l)
        .collect::<Vec<_>>()
        .join("\n")
}

fn key_str(k: &Y) -> String {
    match k {
        Y::String(s) => s.clone(),
        Y::Number(n) => n.to_string(),
        Y::Bool(b) => b.to_string(),
        _ => String::new(),
    }
}

fn get<'a>(v: &'a Y, key: &str) -> Option<&'a Y> {
    match v {
        Y::Mapping(m) => m.iter().find(|(k, _)| key_str(k) == key).map(|(_, v)| v),
        _ => None,
    }
}

fn entries(v: Option<&Y>) -> Vec<(String, &Y)> {
    match v {
        Some(Y::Mapping(m)) => m.iter().map(|(k, v)| (key_str(k), v)).collect(),
        Some(Y::Sequence(s)) => s.iter().enumerate().map(|(i, v)| (i.to_string(), v)).collect(),
        _ => vec![],
    }
}

fn num(v: Option<&Y>) -> Option<f64> {
    match v? {
        Y::Number(n) => n.as_f64(),
        Y::String(s) => s.trim().trim_end_matches('%').parse().ok(),
        _ => None,
    }
}

fn st(v: Option<&Y>) -> Option<String> {
    match v? {
        Y::String(s) => Some(s.clone()),
        Y::Number(n) => Some(n.to_string()),
        Y::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

fn boolean(v: Option<&Y>) -> Option<bool> {
    match v? {
        Y::Bool(b) => Some(*b),
        Y::String(s) => match s.trim().to_ascii_lowercase().as_str() {
            "true" | "yes" | "on" => Some(true),
            "false" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

/// `{x: 1, y: 2}` or `"1, 2"`
fn xy(v: Option<&Y>) -> Option<(f64, f64)> {
    let v = v?;
    if let Y::String(s) = v {
        let mut it = s.split(',').map(|p| p.trim().parse::<f64>());
        return match (it.next(), it.next()) {
            (Some(Ok(x)), Some(Ok(y))) => Some((x, y)),
            _ => None,
        };
    }
    Some((num(get(v, "x")).unwrap_or(0.0), num(get(v, "y")).unwrap_or(0.0)))
}

fn str_list(v: Option<&Y>) -> Vec<String> {
    match v {
        Some(Y::Sequence(s)) => s.iter().filter_map(|x| st(Some(x))).collect(),
        Some(x) => st(Some(x)).into_iter().collect(),
        None => vec![],
    }
}

/// Merges the top-level keys of every YAML file under `dir` (alphabetical, last wins)
fn merge_dir(vfs: &Vfs, dir: &str, warnings: &mut Vec<String>) -> IndexMap<String, Y> {
    let mut out = IndexMap::new();
    for (path, bytes) in vfs.under(dir) {
        if !is_yaml(path) {
            continue;
        }
        match parse_yaml_noted(bytes) {
            Ok((Y::Mapping(m), dup)) => {
                if dup {
                    warnings.push(format!("{}: a key is written twice — the later one is used (like the plugin)", path));
                }
                for (k, v) in m {
                    out.insert(key_str(&k), v);
                }
            }
            Ok((Y::Null, _)) => {}
            Ok(_) => warnings.push(format!("{}: not a YAML map, skipped", path)),
            Err(e) => warnings.push(format!("{}: could not be read ({})", path, e)),
        }
    }
    out
}

fn load_yaml(vfs: &Vfs, path: &str) -> Option<Y> {
    vfs.get(path).and_then(|b| parse_yaml(b).ok())
}

/* ───────────────────────── images ───────────────────────── */

fn png_size(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() >= 24 && &bytes[0..8] == b"\x89PNG\r\n\x1a\n" {
        let w = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
        let h = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
        return Some((w, h));
    }
    None
}

/// Holds every PNG the import references, so each one is sent to the UI once
struct ImageTable {
    ids: HashMap<String, usize>,
    list: Vec<J>,
}

impl ImageTable {
    fn new() -> Self {
        ImageTable { ids: HashMap::new(), list: vec![] }
    }

    /// Returns (image id, width, height)
    fn add(&mut self, vfs: &Vfs, path: &str) -> Option<(usize, f64, f64)> {
        let bytes = vfs.get(path)?;
        let (w, h) = png_size(bytes)?;
        if let Some(&id) = self.ids.get(path) {
            return Some((id, w as f64, h as f64));
        }
        let id = self.list.len();
        let name = path.rsplit('/').next().unwrap_or(path);
        let name = name.strip_suffix(".png").or_else(|| name.strip_suffix(".PNG")).unwrap_or(name);
        self.list.push(json!({
            "id": id,
            "path": path,
            "name": name,
            "width": w,
            "height": h,
            "data": format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)),
        }));
        self.ids.insert(path.to_string(), id);
        Some((id, w as f64, h as f64))
    }
}

/* ───────────────────────── geometry ───────────────────────── */

/// Screen point given as percentages from the TOP-left corner
struct ScreenPoint {
    anchor: String,
    fx: f64,
    fy: f64,
    /// extra pixels when the percentage was not 0/50/100
    dx: f64,
    dy: f64,
}

fn snap(pct: f64) -> (f64, &'static str, f64) {
    let opts = [(0.0, 0.0), (50.0, 0.5), (100.0, 1.0)];
    let mut best = opts[0];
    for o in opts {
        if (pct - o.0).abs() < (pct - best.0).abs() {
            best = o;
        }
    }
    let name = match best.1 {
        x if x == 0.0 => "a",
        x if x == 0.5 => "m",
        _ => "b",
    };
    (best.1, name, (pct - best.0) / 100.0)
}

fn screen_point(px: f64, py_from_top: f64, notes: &mut Vec<String>) -> ScreenPoint {
    let (fx, hx, rx) = snap(px);
    let (fy, vy, ry) = snap(py_from_top);
    let h = match hx { "a" => "left", "m" => "middle", _ => "right" };
    let v = match vy { "a" => "top", "m" => "middle", _ => "bottom" };
    let anchor = match (v, h) {
        ("middle", "middle") => "center".to_string(),
        ("middle", h) => format!("middle_{}", h),
        (v, h) => format!("{}_{}", v, h),
    };
    if rx.abs() > 0.001 || ry.abs() > 0.001 {
        notes.push(format!(
            "Screen position {}%, {}% is not 0/50/100: placed for a {}×{} GUI screen, check it on other sizes",
            px, py_from_top, REF_W, REF_H
        ));
    }
    ScreenPoint { anchor, fx, fy, dx: rx * REF_W, dy: ry * REF_H }
}

fn r2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// Element whose top-left corner is `(left, top)` px from the screen point (y down)
#[allow(clippy::too_many_arguments)]
fn place(sp: &ScreenPoint, left: f64, top: f64, w: f64, h: f64) -> (String, [f64; 2], [f64; 2]) {
    let ox = sp.dx + left + w * sp.fx;
    let oy = sp.dy + top + h * sp.fy;
    (sp.anchor.clone(), [r2(ox), r2(oy)], [r2(w.max(1.0)), r2(h.max(1.0))])
}

/// Text elements are exported as a 1×1 panel with the label anchored inside it, so the
/// offset is the text's own anchor point (left / centre / right edge), not a box corner.
fn text_point(sp: &ScreenPoint, left: f64, top: f64, w: f64, h: f64, align: &str) -> [f64; 2] {
    let (x, y) = match align {
        "right" => (left + w, top),
        "center" => (left + w / 2.0, top + h / 2.0),
        _ => (left, top),
    };
    [r2(sp.dx + x), r2(sp.dy + y)]
}

/* ───────────────────────── text helpers ───────────────────────── */

fn legacy_color(c: char) -> Option<&'static str> {
    Some(match c.to_ascii_lowercase() {
        '0' => "#000000", '1' => "#0000AA", '2' => "#00AA00", '3' => "#00AAAA",
        '4' => "#AA0000", '5' => "#AA00AA", '6' => "#FFAA00", '7' => "#AAAAAA",
        '8' => "#555555", '9' => "#5555FF", 'a' => "#55FF55", 'b' => "#55FFFF",
        'c' => "#FF5555", 'd' => "#FF55FF", 'e' => "#FFFF55", 'f' => "#FFFFFF",
        _ => return None,
    })
}

fn named_color(n: &str) -> Option<&'static str> {
    Some(match n.to_ascii_lowercase().as_str() {
        "black" => "#000000", "dark_blue" => "#0000AA", "dark_green" => "#00AA00",
        "dark_aqua" => "#00AAAA", "dark_red" => "#AA0000", "dark_purple" => "#AA00AA",
        "gold" => "#FFAA00", "gray" | "grey" => "#AAAAAA", "dark_gray" | "dark_grey" => "#555555",
        "blue" => "#5555FF", "green" => "#55FF55", "aqua" => "#55FFFF", "red" => "#FF5555",
        "light_purple" => "#FF55FF", "yellow" => "#FFFF55", "white" => "#FFFFFF",
        _ => return None,
    })
}

fn hex_to_rgb(h: &str) -> Option<[f64; 3]> {
    let h = h.trim().trim_start_matches('#');
    if h.len() < 6 {
        return None;
    }
    let p = |i: usize| u8::from_str_radix(&h[i..i + 2], 16).ok().map(|v| r2(v as f64 / 255.0));
    Some([p(0)?, p(2)?, p(4)?])
}

/// BetterHud built-in placeholders → PlaceholderAPI
fn betterhud_builtin(name: &str) -> Option<&'static str> {
    Some(match name {
        "level" => "%player_level%",
        "health" => "%player_health_rounded%",
        "max_health" => "%player_max_health_rounded%",
        "health_percentage" => "%player_health_scale%",
        "food" => "%player_food_level%",
        "air" => "%player_remaining_air%",
        "max_air" => "%player_max_air%",
        "absorption" => "%player_absorption%",
        "name" => "%player_name%",
        "world" => "%player_world%",
        "gamemode" => "%player_gamemode%",
        "hotbar_slot" => "%player_item_in_hand_slot%",
        "vault_money" => "%vault_eco_balance%",
        _ => return None,
    })
}

struct ParsedText {
    papi: String,
    plain_len: usize,
    color: Option<String>,
    leading_icons: Vec<String>,
    notes: Vec<String>,
}

/// Converts a text pattern to a PlaceholderAPI string.
/// `bracket_placeholders`: BetterHud `[papi:x]` syntax (otherwise `%x%` is kept).
fn parse_pattern(p: &str, bracket_placeholders: bool) -> ParsedText {
    parse_pattern_with(p, bracket_placeholders, &IndexMap::new())
}

/// Same, with BetterHud's own placeholders (`placeholders/*.yml`) for `[string:name]`
fn parse_pattern_with(p: &str, bracket_placeholders: bool, custom: &IndexMap<String, String>) -> ParsedText {
    let mut out = String::new();
    let mut color = None;
    let mut icons = vec![];
    let mut notes = vec![];
    let mut seen_text = false;
    let chars: Vec<char> = p.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if (c == '&' || c == '§') && i + 1 < chars.len() {
            let n = chars[i + 1];
            if let Some(col) = legacy_color(n) {
                if color.is_none() {
                    color = Some(col.to_string());
                }
                i += 2;
                continue;
            }
            if "klmnorKLMNOR".contains(n) {
                i += 2;
                continue;
            }
            if n == '#' && i + 8 <= chars.len() {
                let hex: String = chars[i + 1..i + 8].iter().collect();
                if hex_to_rgb(&hex).is_some() {
                    if color.is_none() {
                        color = Some(hex);
                    }
                    i += 8;
                    continue;
                }
            }
        }
        if c == '<' {
            if let Some(end) = chars[i..].iter().position(|&x| x == '>') {
                let tag: String = chars[i + 1..i + end].iter().collect();
                let t = tag.trim();
                if let Some(id) = t.strip_prefix("image:") {
                    if !seen_text {
                        icons.push(id.trim().to_string());
                    } else {
                        notes.push(format!("Inline icon <image:{}> inside the text was removed", id.trim()));
                    }
                } else if t.starts_with('#') {
                    if color.is_none() && hex_to_rgb(t).is_some() {
                        color = Some(t.to_string());
                    }
                } else if let Some(col) = t.strip_prefix("color:").and_then(named_color).or_else(|| named_color(t)) {
                    if color.is_none() {
                        color = Some(col.to_string());
                    }
                }
                i += end + 1;
                continue;
            }
        }
        // BetterHud: '/' escapes the next character ('//' = '/', '/[' = '[')
        if bracket_placeholders && c == '/' && i + 1 < chars.len() {
            out.push(chars[i + 1]);
            seen_text = true;
            i += 2;
            continue;
        }
        if bracket_placeholders && c == '[' {
            if let Some(end) = chars[i..].iter().position(|&x| x == ']') {
                let inner: String = chars[i + 1..i + end].iter().collect();
                let mut inner = inner.trim().to_string();
                for pre in ["(number)", "(string)", "(boolean)"] {
                    if let Some(r) = inner.strip_prefix(pre) {
                        inner = r.trim().to_string();
                    }
                }
                if let Some(at) = inner.find('@') {
                    notes.push(format!("Math on a placeholder ({}) is not supported and was dropped", &inner[at..]));
                    inner.truncate(at);
                }
                let typed = ["string:", "number:", "boolean:"].iter().find_map(|t| inner.strip_prefix(t)).map(|r| r.trim().to_string());
                let ph = if let Some(r) = inner.strip_prefix("papi:") {
                    format!("%{}%", r.trim())
                } else if let Some(def) = typed.as_ref().and_then(|n| custom.get(n)) {
                    def.clone()
                } else if let Some(n) = typed.as_ref().filter(|n| !n.is_empty()) {
                    notes.push(format!("[{}] is not defined in placeholders/ — converted to %{}%, check it", inner, n));
                    format!("%{}%", n)
                } else if let Some(def) = custom.get(&inner) {
                    def.clone()
                } else if let Some(b) = betterhud_builtin(&inner) {
                    b.to_string()
                } else {
                    notes.push(format!("[{}] is a BetterHud placeholder, converted to %{}% — check it", inner, inner));
                    format!("%{}%", inner)
                };
                out.push_str(&ph);
                seen_text = true;
                i += end + 1;
                continue;
            }
        }
        if !c.is_whitespace() {
            seen_text = true;
        }
        if seen_text || !c.is_whitespace() {
            out.push(c);
        }
        i += 1;
    }
    let papi = out.trim().to_string();
    // rough visible length: placeholders count as ~5 characters
    let mut plain_len = 0;
    let mut in_ph = false;
    for c in papi.chars() {
        if c == '%' {
            in_ph = !in_ph;
            if in_ph {
                plain_len += 5;
            }
        } else if !in_ph {
            plain_len += 1;
        }
    }
    ParsedText { papi, plain_len: plain_len.max(1), color, leading_icons: icons, notes }
}

fn font_size_for(scale: f64) -> &'static str {
    if scale < 0.75 {
        "small"
    } else if scale < 1.5 {
        "normal"
    } else {
        "large"
    }
}

/* ───────────────────────── bars ───────────────────────── */

fn vanilla_bar(class: &str) -> Option<&'static str> {
    Some(match class.to_ascii_lowercase().as_str() {
        "health" => "hp",
        "food" | "hunger" => "food",
        "armor" => "armor",
        "air" => "air",
        "exp" | "experience" => "exp",
        "absorption" => "hp_absorption",
        _ => return None,
    })
}

/// Integrations BetterHud exposes as listener classes → (value, max)
fn known_listener(class: &str) -> Option<(&'static str, &'static str)> {
    Some(match class {
        "mmocore_mana" => ("%mmocore_mana%", "%mmocore_stat_max_mana%"),
        "mmocore_stamina" => ("%mmocore_stamina%", "%mmocore_stat_max_stamina%"),
        "mmocore_stellium" => ("%mmocore_stellium%", "%mmocore_stat_max_stellium%"),
        "mmocore_exp" | "mmocore_experience" => ("%mmocore_experience%", "%mmocore_next_level%"),
        "aureliumskills_mana" | "auraskills_mana" => ("%auraskills_mana%", "%auraskills_max_mana%"),
        _ => return None,
    })
}

fn strip_bh_cast(s: &str) -> &str {
    let mut s = s.trim();
    loop {
        let next = ["(number)", "(string)", "(boolean)"].iter().find_map(|pre| {
            if s.len() >= pre.len() && s[..pre.len()].eq_ignore_ascii_case(pre) {
                Some(s[pre.len()..].trim())
            } else {
                None
            }
        });
        match next {
            Some(r) => s = r,
            None => return s,
        }
    }
}

fn papi_from_listener_value(v: &str) -> String {
    let s = strip_bh_cast(v);
    let s = s.trim_start_matches('[').trim_end_matches(']');
    let s = strip_bh_cast(s);
    if let Some(r) = s.strip_prefix("papi:") {
        format!("%{}%", r.trim())
    } else {
        s.to_string()
    }
}

fn bar_json(kind: &str, papi: &str, max: &str, direction: &str, steps: f64) -> J {
    json!({ "type": kind, "papi": papi, "max": max, "direction": direction, "steps": steps })
}

/* ───────────────────────── element builder ───────────────────────── */

struct Hud {
    id: String,
    name: String,
    default: bool,
    elements: Vec<J>,
    notes: Vec<String>,
}

impl Hud {
    fn to_json(&self) -> J {
        json!({ "id": self.id, "name": self.name, "default": self.default,
                "elements": self.elements, "notes": self.notes })
    }
}

fn notes_json(n: Vec<String>) -> J {
    let mut seen = BTreeSet::new();
    J::Array(n.into_iter().filter(|x| seen.insert(x.clone())).map(J::String).collect())
}

/* ───────────────────────── BetterHud ───────────────────────── */

/// Picture file of an image definition (first frame for sequences)
fn betterhud_file(idef: &Y) -> Option<String> {
    let itype = st(get(idef, "type")).unwrap_or_else(|| "single".into()).to_ascii_lowercase();
    if itype == "sequence" {
        betterhud_sequence(idef).into_iter().next().map(|(f, _)| f)
    } else {
        st(get(idef, "file"))
    }
}

/// Frames of a BetterHud `sequence` image as (file, ticks): `name.png:16` shows the
/// frame for 16 ticks, no number = 1 tick
fn betterhud_sequence(idef: &Y) -> Vec<(String, u32)> {
    str_list(get(idef, "files"))
        .into_iter()
        .map(|f| match f.rsplit_once(':') {
            Some((a, t)) if t.trim().parse::<u32>().is_ok() => (a.to_string(), t.trim().parse::<u32>().unwrap_or(1).max(1)),
            _ => (f, 1),
        })
        .collect()
}

fn gcd(a: u32, b: u32) -> u32 {
    if b == 0 { a } else { gcd(b, a % b) }
}

/// Frame-by-frame animation for the editor: `{ frames: [image ids], fps }`.
/// Identical frames in a row are merged (packs often repeat a frame 4× to slow it down)
/// and the timing becomes one fixed frame rate, like Bedrock's flip_book animation.
/// `tick_ms` = how long one plugin tick lasts. Returns None for a still picture.
fn build_anim(vfs: &Vfs, imgs: &mut ImageTable, bases: &[String], frames: &[(String, u32)], tick_ms: f64, notes: &mut Vec<String>) -> Option<J> {
    let mut runs: Vec<(usize, u32, String)> = vec![]; // (image id, ticks, path)
    let mut missing = 0;
    let mut first_size = None;
    let mut mixed_size = false;
    for (file, ticks) in frames {
        let Some(path) = vfs.resolve_png(bases, file) else {
            missing += 1;
            continue;
        };
        if let Some(last) = runs.last_mut() {
            if last.2 == path || vfs.get(&last.2) == vfs.get(&path) {
                last.1 += ticks;
                continue;
            }
        }
        let Some((id, w, h)) = imgs.add(vfs, &path) else { continue };
        match first_size {
            None => first_size = Some((w, h)),
            Some(s) if s != (w, h) => mixed_size = true,
            _ => {}
        }
        runs.push((id, *ticks, path));
    }
    if missing > 0 {
        notes.push(format!("{} animation frame(s) are missing from the pack and were skipped", missing));
    }
    if runs.len() < 2 {
        return None;
    }
    if mixed_size {
        notes.push("Animation frames have different sizes — all frames are scaled to the first one".into());
    }
    let g = runs.iter().fold(0, |a, r| gcd(a, r.1)).max(1);
    let mut ids: Vec<usize> = vec![];
    for (id, t, _) in &runs {
        for _ in 0..(t / g) {
            ids.push(*id);
        }
    }
    let mut step = g as f64;
    if ids.len() > 96 {
        // very uneven timings: keep one copy of each frame and use the average time
        ids = runs.iter().map(|r| r.0).collect();
        step = runs.iter().map(|r| r.1 as f64).sum::<f64>() / runs.len() as f64;
        notes.push("Animation frames have very different timings — imported with one even frame rate".into());
    }
    let fps = (1000.0 / (step * tick_ms)).clamp(0.1, 60.0);
    Some(json!({ "frames": ids, "fps": r2(fps) }))
}

/// `placeholders/*.yml`: name → PlaceholderAPI text, for `[string:name]` / `[number:name]`
fn betterhud_placeholders(defs: &IndexMap<String, Y>) -> IndexMap<String, String> {
    let mut out = IndexMap::new();
    for (k, v) in defs {
        let ph = st(get(v, "placeholder")).or_else(|| st(get(v, "value")));
        if let Some(ph) = ph {
            out.insert(k.clone(), ph.clone());
            if let Some(var) = st(get(v, "variable")) {
                out.entry(var).or_insert(ph);
            }
        }
    }
    out
}

fn parse_betterhud(vfs: &Vfs, root: &str, overlay: Option<&str>, imgs: &mut ImageTable) -> (Vec<Hud>, Vec<String>, J) {
    let mut warns = vec![];
    let images = merge_dir(vfs, &format!("{}images/", root), &mut warns);
    let mut layouts = merge_dir(vfs, &format!("{}layouts/", root), &mut warns);
    if let Some(o) = overlay {
        // an add-on folder that only replaces some layouts ("drag V.2 over V.1")
        let extra = merge_dir(vfs, &format!("{}layouts/", o), &mut warns);
        warns.push(format!("Layouts from '{}' ({}) are used on top of '{}'", o.trim_end_matches('/'), extra.len(), root.trim_end_matches('/')));
        layouts.extend(extra);
    }
    let huds = merge_dir(vfs, &format!("{}huds/", root), &mut warns);
    let texts = merge_dir(vfs, &format!("{}texts/", root), &mut warns);
    let heads = merge_dir(vfs, &format!("{}heads/", root), &mut warns);
    let custom_ph = betterhud_placeholders(&merge_dir(vfs, &format!("{}placeholders/", root), &mut warns));
    let config = load_yaml(vfs, &format!("{}config.yml", root));
    // BetterHud updates the HUD every `tick-speed` server ticks (50 ms each)
    let tick_ms = 50.0 * config.as_ref().and_then(|c| num(get(c, "tick-speed"))).filter(|t| *t >= 1.0).unwrap_or(1.0);

    // BetterHud source (PixelLocation.hotBarHeight): unless disable-legacy-offset is true,
    // every layout gets an extra (0, -54) pixel offset
    // A config.yml without the key gets BetterHud's default (false = legacy offset on; older
    // builds such as beta-26 had no switch at all — HudGraveyard's bars only fit above the
    // hotbar with it). Packs that ship no config.yml (tt_modern) are drawn without it.
    let legacy = config
        .as_ref()
        .map(|c| boolean(get(c, "disable-legacy-offset")).map(|disabled| !disabled).unwrap_or(true))
        .unwrap_or(false);
    let y_shift = if legacy { -54.0 } else { 0.0 };
    if legacy {
        warns.push("config.yml uses the legacy offset (disable-legacy-offset: false): layouts moved up 54px".into());
    }
    let defaults: BTreeSet<String> = config.as_ref().map(|c| str_list(get(c, "default-hud"))).unwrap_or_default().into_iter().collect();

    let asset_base = vec![format!("{}assets/", root), root.to_string()];
    let mut out = vec![];

    for (hud_id, hud) in &huds {
        let mut h = Hud { id: hud_id.clone(), name: hud_id.clone(), default: defaults.contains(hud_id), elements: vec![], notes: vec![] };
        for (_, lref) in entries(get(hud, "layouts")) {
            let Some(lname) = st(get(lref, "name")) else { continue };
            let Some(layout0) = layouts.get(&lname) else {
                h.notes.push(format!("Layout '{}' was not found", lname));
                continue;
            };
            let layout = get(layout0, "layout").filter(|l| matches!(l, Y::Mapping(_))).unwrap_or(layout0);
            let mut notes = vec![];
            // HudImpl: the entry's x/y plus an optional nested `gui:` (percent), plus `pixel:`
            let (mut gx, mut gy) = (num(get(lref, "x")).unwrap_or(0.0), num(get(lref, "y")).unwrap_or(0.0));
            if let Some((ax, ay)) = get(lref, "gui").and_then(|g| xy(Some(g))) {
                gx += ax;
                gy += ay;
            }
            let sp = screen_point(gx.clamp(0.0, 100.0), gy.clamp(0.0, 100.0), &mut notes);
            h.notes.extend(notes);
            let (px, py) = get(lref, "pixel").and_then(|p| xy(Some(p))).unwrap_or((0.0, 0.0));
            // LayoutGroup: `align` (default LEFT) moves each element inside the widest image,
            // `offset` (default CENTER) shifts the whole line by 0 / -max/2 / -max
            let lalign = st(get(layout, "align")).unwrap_or_default().to_ascii_lowercase();
            let loffset = st(get(layout, "offset")).unwrap_or_default().to_ascii_lowercase();
            let max_w = entries(get(layout, "images"))
                .iter()
                .filter_map(|(_, e)| {
                    let idef = images.get(&st(get(e, "name"))?)?;
                    let path = vfs.resolve_png(&asset_base, &betterhud_file(idef)?)?;
                    let (w, _) = png_size(vfs.get(&path)?)?;
                    Some(w as f64 * num(get(e, "scale")).unwrap_or(1.0) * num(get(idef, "scale")).unwrap_or(1.0))
                })
                .fold(0.0, f64::max);
            let line_off = match loffset.as_str() {
                "left" => 0.0,
                "right" => -max_w,
                _ => -max_w / 2.0,
            };
            let move_in = |w: f64| match lalign.as_str() {
                "center" => (max_w - w) / 2.0,
                "right" => max_w - w,
                _ => 0.0,
            };
            let base_x = px + line_off;
            let base_y = py + y_shift;
            if get(layout, "animations").is_some() {
                h.notes.push(format!("Layout '{}' has animations — imported without them", lname));
            }
            // conditions on the whole layout (e.g. gamemode == SURVIVAL) are added to every
            // picture, bar and head in it (on top of the item's own conditions)
            let layout_conds = get(layout, "conditions").or_else(|| get(lref, "conditions"));
            let (layout_vis, _) = convert_betterhud_conditions(layout_conds);
            if !layout_vis.is_empty() {
                let all: Vec<String> = layout_vis.iter().map(|c| format!("{} {} {}", c.papi, c.op, c.value)).collect();
                h.notes.push(format!("Layout '{}' is only shown while {} — set on its pictures, bars and heads", lname, all.join(" and ")));
            }

            // images
            for (eid, e) in entries(get(layout, "images")) {
                let mut notes = vec![];
                let Some(iname) = st(get(e, "name")) else { continue };
                let Some(idef) = images.get(&iname) else {
                    h.notes.push(format!("Image '{}' was not found", iname));
                    continue;
                };
                let itype = st(get(idef, "type")).unwrap_or_else(|| "single".into()).to_ascii_lowercase();
                let anim = if itype == "sequence" {
                    build_anim(vfs, imgs, &asset_base, &betterhud_sequence(idef), tick_ms, &mut notes)
                } else {
                    None
                };
                let file = betterhud_file(idef);
                let Some(file) = file else { continue };
                let Some(path) = vfs.resolve_png(&asset_base, &file) else {
                    h.notes.push(format!("Picture '{}' for image '{}' is missing from the pack", file, iname));
                    continue;
                };
                let Some((img, w, hgt)) = imgs.add(vfs, &path) else { continue };
                let scale = num(get(e, "scale")).unwrap_or(1.0) * num(get(idef, "scale")).unwrap_or(1.0);
                let (w, hgt) = (w * scale, hgt * scale);
                let x = num(get(e, "x")).unwrap_or(0.0) + base_x + move_in(w);
                let y = num(get(e, "y")).unwrap_or(0.0) + base_y;
                if get(e, "stack").is_some() {
                    notes.push("Uses 'stack' (repeated icons) — imported as a single picture".into());
                }
                let own = get(e, "conditions").or_else(|| get(idef, "conditions"));
                let (bh_vis, cond_notes) = convert_betterhud_conditions(own);
                notes.extend(cond_notes);
                let (bh_vis, bh_extra) = vis_fields(bh_vis.iter().chain(layout_vis.iter()));
                let (anchor, offset, size) = place(&sp, x, y, w, hgt);
                let layer = num(get(e, "layer")).unwrap_or(0.0);

                let mut bar = J::Null;
                if itype == "listener" {
                    let listener = get(idef, "setting").and_then(|s| get(s, "listener")).or_else(|| get(idef, "listener"));
                    let class = listener.and_then(|l| st(get(l, "class"))).unwrap_or_default();
                    let split = num(get(idef, "split")).unwrap_or(16.0);
                    let direction = match st(get(idef, "split-type")).unwrap_or_else(|| "left".into()).to_ascii_lowercase().as_str() {
                        "right" => "right",
                        "up" => "bottom",
                        "down" => "top",
                        "circle" | "reverse_circle" => {
                            notes.push("Circular bar is not supported — imported as a left-to-right bar".into());
                            "left"
                        }
                        _ => "left",
                    };
                    bar = if let Some(t) = vanilla_bar(&class) {
                        bar_json(t, "", "", direction, split)
                    } else if class == "placeholder" {
                        let l = listener.unwrap();
                        let v = st(get(l, "value")).map(|s| papi_from_listener_value(&s)).unwrap_or_default();
                        let m = st(get(l, "max")).or_else(|| st(get(l, "max-value"))).map(|s| papi_from_listener_value(&s)).unwrap_or_default();
                        bar_json("custom", &v, &m, direction, split)
                    } else if let Some((v, m)) = known_listener(&class) {
                        bar_json("custom", v, m, direction, split)
                    } else {
                        notes.push(format!("Unknown bar source '{}' — set the placeholder yourself", class));
                        bar_json("custom", &format!("%{}%", class), "", direction, split)
                    };
                }
                let mut item = json!({
                    "kind": if bar.is_null() { "image" } else { "bar" },
                    "name": iname, "key": format!("{}/images/{}", lname, eid),
                    "image": img, "anchor": anchor, "offset": offset, "size": size,
                    "layer": layer, "bar": bar, "visibility": bh_vis, "visibility_extra": bh_extra, "notes": notes_json(notes),
                });
                if let Some(a) = anim.filter(|_| bar.is_null()) {
                    item["anim"] = a;
                }
                h.elements.push(item);
            }

            // texts
            let mut seen_texts: Vec<(String, String, i64, i64)> = vec![];
            let mut merged_texts = 0usize;
            for (eid, e) in entries(get(layout, "texts")) {
                let mut notes = vec![];
                let font_id = st(get(e, "name")).unwrap_or_default();
                let font = texts.get(&font_id);
                let font_scale = font.and_then(|f| num(get(f, "scale"))).unwrap_or(16.0) / 8.0; // BetterHud text font: 16 px at scale 1, vanilla text is 8 px
                let scale = num(get(e, "scale")).unwrap_or(1.0);
                let eff = scale * font_scale;
                let pattern = st(get(e, "pattern")).unwrap_or_default();
                let pt = parse_pattern_with(&pattern, true, &custom_ph);
                notes.extend(pt.notes.clone());
                let has_conds = get(e, "conditions").is_some();
                let (tvis, tcond_notes) = convert_betterhud_conditions(get(e, "conditions"));
                let (icon_vis, icon_vis_extra) = vis_fields(tvis.iter().chain(layout_vis.iter()));
                if has_conds {
                    notes.push("Scoreboard texts can't be hidden by a condition in the Bedrock export - this text is always shown".into());
                    notes.extend(tcond_notes.clone());
                }
                if let Some(bg) = st(get(e, "background")) {
                    notes.push(format!("Text background '{}' is not supported on Bedrock — imported without the background box", bg));
                }
                let orig_x = num(get(e, "x")).unwrap_or(0.0) + base_x;
                let mut x = orig_x;
                let y = num(get(e, "y")).unwrap_or(0.0) + base_y;
                let layer = num(get(e, "layer")).unwrap_or(0.0);
                let align = st(get(e, "align")).unwrap_or_else(|| "left".into()).to_ascii_lowercase();
                let tw = (pt.plain_len as f64 * 6.0 * eff).max(4.0);
                let th = 9.0 * eff;

                // icons in front of the text become their own pictures (and CAN keep their visibility conditions)
                let mut icon_w = 0.0;
                let mut icon_elems = vec![];
                for icon in &pt.leading_icons {
                    let glyph = font.and_then(|f| get(f, "images")).and_then(|m| get(m, icon));
                    let Some(g) = glyph else {
                        notes.push(format!("Icon <image:{}> is not defined in the font", icon));
                        continue;
                    };
                    let Some(file) = st(get(g, "name")).or_else(|| st(get(g, "file"))) else { continue };
                    let Some(path) = vfs.resolve_png(&asset_base, &file) else { continue };
                    let Some((img, w, hh)) = imgs.add(vfs, &path) else { continue };
                    let gs = num(get(g, "scale")).unwrap_or(1.0) * scale;
                    icon_elems.push((icon.clone(), img, w * gs, hh * gs));
                    icon_w += w * gs + 1.0;
                }
                let total_w = icon_w + tw;
                let left = match align.as_str() {
                    "center" => x - total_w / 2.0,
                    "right" => x - total_w,
                    _ => x,
                };
                x = left;
                for (icon, img, w, hh) in icon_elems {
                    let top = y + (th - hh) / 2.0;
                    let (anchor, offset, size) = place(&sp, x, top, w, hh);
                    h.elements.push(json!({
                        "kind": "image", "name": icon, "key": format!("{}/texts/{}/{}", lname, eid, icon),
                        "image": img, "anchor": anchor, "offset": offset, "size": size,
                        "layer": layer, "bar": J::Null,
                        "visibility": icon_vis, "visibility_extra": icon_vis_extra,
                        "notes": notes_json(tcond_notes.clone()),
                    }));
                    x += w + 1.0;
                }
                if pt.papi.is_empty() {
                    continue;
                }
                // Packs often repeat the same text at the same spot in green / yellow / red with conditions
                // (e.g. PrimeHUD ping / tps / ram). Bedrock texts cannot be hidden, so keep the first colour once.
                let tkey = (pt.papi.clone(), align.clone(), (orig_x * 2.0).round() as i64, (y * 2.0).round() as i64);
                if has_conds && seen_texts.contains(&tkey) {
                    merged_texts += 1;
                    continue;
                }
                seen_texts.push(tkey);
                let talign = if align == "center" || align == "right" { align.as_str() } else { "left" };
                let (anchor, _, size) = place(&sp, x, y, tw, th);
                let offset = text_point(&sp, x, y, tw, th, talign);
                h.elements.push(json!({
                    "kind": "text", "name": format!("{}_text_{}", lname, eid), "key": format!("{}/texts/{}", lname, eid),
                    "anchor": anchor, "offset": offset, "size": size, "layer": layer,
                    "text": {
                        "papi": pt.papi, "source": pattern, "align": talign,
                        "color": pt.color.as_deref().and_then(hex_to_rgb),
                        "fontSize": font_size_for(eff),
                        "shadow": boolean(get(e, "outline")).unwrap_or(false),
                    },
                    "notes": notes_json(notes),
                }));
            }
            if merged_texts > 0 {
                h.notes.push(format!(
                    "{}: {} more colour version(s) of the same text (chosen by a condition) were left out — texts can't be hidden on Bedrock, so the first colour is always shown; the icons still change",
                    lname, merged_texts
                ));
            }

            // heads
            for (eid, e) in entries(get(layout, "heads")) {
                let hname = st(get(e, "name")).unwrap_or_default();
                let pixel = heads.get(&hname).and_then(|d| num(get(d, "pixel"))).unwrap_or(1.0);
                let s = 8.0 * pixel;
                let x = num(get(e, "x")).unwrap_or(0.0) + base_x;
                let y = num(get(e, "y")).unwrap_or(0.0) + base_y;
                let (anchor, offset, size) = place(&sp, x, y, s, s);
                let mut notes = vec![];
                if get(e, "follow").is_some() {
                    notes.push("Shows another player's head (follow) — imported as your own head".into());
                }
                let (vis, cn) = convert_betterhud_conditions(get(e, "conditions"));
                notes.extend(cn);
                let (vis, vis_extra) = vis_fields(vis.iter().chain(layout_vis.iter()));
                h.elements.push(json!({
                    "kind": "head", "name": hname, "key": format!("{}/heads/{}", lname, eid),
                    "anchor": anchor, "offset": offset, "size": size, "visibility": vis, "visibility_extra": vis_extra,
                    "layer": num(get(e, "layer")).unwrap_or(0.0), "notes": notes_json(notes),
                }));
            }
        }
        if !h.elements.is_empty() || !h.notes.is_empty() {
            out.push(h);
        }
    }
    let extras: Vec<&str> = ["popups", "compasses"]
        .into_iter()
        .filter(|d| vfs.has_yaml_under(&format!("{}{}/", root, d)))
        .collect();
    if !extras.is_empty() {
        warns.push(format!("Not imported (no Bedrock equivalent yet): {}", extras.join(", ")));
    }
    (out, warns, json!({ "legacyOffset": legacy }))
}

/* ───────────────────────── HappyHUD / MythicHUD ───────────────────────── */

#[derive(Clone, Debug, PartialEq)]
struct Cond {
    papi: String,
    op: String,
    value: String,
}

/// Element fields for its conditions (all must hold): `visibility` = the first one (the editor's
/// Visibility Condition), `visibility_extra` = the rest (the editor's "+ Add condition" rows)
fn vis_fields<'a>(conds: impl IntoIterator<Item = &'a Cond>) -> (J, J) {
    let mut seen: Vec<&Cond> = vec![];
    for c in conds {
        if !seen.iter().any(|s| s.papi == c.papi && s.op == c.op && s.value == c.value) {
            seen.push(c);
        }
    }
    let j = |c: &&Cond| json!({ "papi": c.papi, "op": c.op, "value": c.value });
    (seen.first().map(j).unwrap_or(J::Null), J::Array(seen.iter().skip(1).map(j).collect()))
}

/// One HappyHUD / MythicHUD condition: `type{args} [outcome] action [argument]`
struct RawCond {
    kind: String,
    args: HashMap<String, String>,
    outcome: bool,
    action: String,
}

fn parse_cond(c: &str) -> Option<RawCond> {
    let c = c.trim();
    let open = c.find('{')?;
    let close = c.rfind('}')?;
    let kind = c[..open].trim().to_ascii_lowercase();
    let rest: Vec<&str> = c[close + 1..].split_whitespace().collect();
    let (outcome, action) = match rest.as_slice() {
        [] => return None,
        [a, ..] if !a.eq_ignore_ascii_case("true") && !a.eq_ignore_ascii_case("false") => (true, a.to_ascii_lowercase()),
        [o, a, ..] => (o.eq_ignore_ascii_case("true"), a.to_ascii_lowercase()),
        _ => return None,
    };
    // split on ';' only outside of {...} (placeholders may contain braces)
    let mut depth = 0i32;
    let mut parts = vec![];
    let mut cur = String::new();
    for ch in c[open + 1..close].chars() {
        match ch {
            '{' => depth += 1,
            '}' => depth -= 1,
            ';' if depth == 0 => {
                parts.push(std::mem::take(&mut cur));
                continue;
            }
            _ => {}
        }
        cur.push(ch);
    }
    parts.push(cur);
    let mut args = HashMap::new();
    for p in parts {
        let Some((k, v)) = p.split_once('=') else { continue };
        let key = match k.trim().to_ascii_lowercase().as_str() {
            "ph" | "1" | "placeholder" => "ph",
            "v" | "val" | "value" | "2" => "v",
            "o" | "oper" | "operation" => "o",
            "l" | "lay" | "layer" => "l",
            "e" | "effect" => "e",
            "gm" | "g" | "gamemode" | "mode" => "gm",
            _ => continue,
        };
        args.insert(key.to_string(), v.trim().to_string());
    }
    Some(RawCond { kind, args, outcome, action })
}

/// Effect name for %player_has_potioneffect_<EFFECT>%: the current Minecraft key in capitals.
/// Packs still use the old Bukkit names (`damage_resistance`); Paper 26.x no longer knows them and
/// the PlaceholderAPI Player expansion throws on every update (IllegalArgumentException in
/// CraftPotionEffectType), which also stops the whole HUD bossbar from updating.
fn modern_effect_name(raw: &str) -> String {
    let n = raw.trim().trim_start_matches("minecraft:").to_ascii_lowercase().replace([' ', '-'], "_");
    let m = match n.as_str() {
        "damage_resistance" => "resistance",
        "slow" => "slowness",
        "fast_digging" => "haste",
        "slow_digging" => "mining_fatigue",
        "increase_damage" => "strength",
        "heal" => "instant_health",
        "harm" => "instant_damage",
        "jump" => "jump_boost",
        "confusion" => "nausea",
        "unluck" => "bad_luck",
        other => other,
    };
    m.to_ascii_uppercase()
}

fn norm_op(o: &str) -> Option<&'static str> {
    Some(match o.trim() {
        "=" | "==" | "" => "==",
        ">" => ">",
        ">=" | "=>" => ">=",
        "<" => "<",
        "<=" | "=<" => "<=",
        "!=" => "!=",
        _ => return None,
    })
}

fn invert_op(o: &str) -> &'static str {
    match o {
        "==" => "!=",
        "!=" => "==",
        ">" => "<=",
        ">=" => "<",
        "<" => ">=",
        _ => ">",
    }
}

/// `... <outcome> hide` keeps the layer visible only while the test gives <outcome>
/// (Blossom: armor `progress{o=>;v=0} true hide` = show while armored; party HUD:
/// `placeholder{ph=%mmocore_party_count%;v=1;o==} false hide` = show unless count is 1)
fn visible_when(papi: String, op: &str, value: String, outcome: bool) -> Cond {
    let op = if outcome { op } else { invert_op(op) };
    Cond { papi, op: op.to_string(), value }
}

/// PlaceholderAPI value + numeric max for a bar listener (for `progress{...}` conditions)
fn listener_papi(lname: &str, listeners: &IndexMap<String, Y>) -> Option<(String, Option<f64>)> {
    let fixed = match lname {
        "health" => Some(("%player_health%", None)),
        "food" => Some(("%player_food_level%", Some(20.0))),
        "air" => Some(("%player_remaining_air%", Some(300.0))),
        "exp" => Some(("%player_exp%", Some(1.0))),
        _ => None,
    };
    if let Some((p, m)) = fixed {
        return Some((p.to_string(), m));
    }
    let def = listeners
        .get(lname)
        .or_else(|| listeners.iter().find(|(k, _)| squash(k) == squash(lname)).map(|(_, v)| v))?;
    let v = st(get(def, "value"))?;
    let max = st(get(def, "max")).and_then(|m| m.trim().parse::<f64>().ok());
    Some((v, max))
}

enum CondResult {
    Visible(Cond),
    /// Several conditions that must all hold (e.g. "not creative and not spectator")
    Many(Vec<Cond>),
    Note(String),
}

/// Turns one condition into an editor Visibility Condition, or explains why it can't be
fn convert_cond(c: &str, layer_listener: &dyn Fn(&str) -> Option<String>, listeners: &IndexMap<String, Y>) -> CondResult {
    let Some(rc) = parse_cond(c) else {
        return CondResult::Note(format!("Condition not understood: {}", c));
    };
    match rc.action.as_str() {
        // "<cond> true hide" and "<cond> true show" both mean: shown while the condition is true
        "hide" | "show" => {}
        "color" | "colour" => return CondResult::Note(format!("Colour change by condition is not supported yet: {}", c)),
        "texture" => return CondResult::Note(format!("Picture change by condition is not supported - the default picture is used: {}", c)),
        _ => return CondResult::Note(format!("Condition action '{}' is not supported: {}", rc.action, c)),
    }
    let Some(op) = norm_op(rc.args.get("o").map(|s| s.as_str()).unwrap_or("==")) else {
        return CondResult::Note(format!("Range conditions are not supported: {}", c));
    };
    match rc.kind.as_str() {
        "placeholder" => {
            let Some(ph) = rc.args.get("ph").cloned() else {
                return CondResult::Note(format!("Condition not understood: {}", c));
            };
            let v = rc.args.get("v").cloned().unwrap_or_else(|| "true".into());
            if v.contains('%') {
                return CondResult::Note(format!("Comparing two placeholders is not supported (the value must be fixed): {}", c));
            }
            CondResult::Visible(visible_when(ph, op, v, rc.outcome))
        }
        "progress" => {
            let layer = rc.args.get("l").cloned().unwrap_or_default();
            let Some(lname) = layer_listener(&layer) else {
                return CondResult::Note(format!("Condition refers to layer '{}' which has no bar: {}", layer, c));
            };
            if lname == "armor" {
                return CondResult::Note("Show/hide by armor points can't be imported: PlaceholderAPI has no armor-points placeholder. Set a Visibility Condition yourself if your server has one".into());
            }
            let Some((papi, max)) = listener_papi(&lname, listeners) else {
                return CondResult::Note(format!("Unknown bar listener '{}': {}", lname, c));
            };
            let raw = rc.args.get("v").cloned().unwrap_or_else(|| "0".into());
            if raw.contains("..") || (raw.contains('-') && !raw.starts_with('-')) {
                return CondResult::Note(format!("Range conditions are not supported: {}", c));
            }
            let value = if let Some(pct) = raw.strip_suffix('%') {
                let Ok(pct) = pct.trim().parse::<f64>() else {
                    return CondResult::Note(format!("Condition not understood: {}", c));
                };
                let Some(m) = max else {
                    return CondResult::Note(format!("Percent condition needs a fixed max value: {}", c));
                };
                let v = pct / 100.0 * m;
                if v.fract() == 0.0 { format!("{}", v as i64) } else { format!("{}", r2(v)) }
            } else {
                raw
            };
            CondResult::Visible(visible_when(papi, op, value, rc.outcome))
        }
        "effect" | "potion" => {
            // PlaceholderAPI Player expansion: %player_has_potioneffect_<EFFECT>% → yes / no
            let Some(e) = rc.args.get("e").map(|s| modern_effect_name(s)).filter(|s| !s.is_empty()) else {
                return CondResult::Note(format!("Condition not understood: {}", c));
            };
            CondResult::Visible(visible_when(format!("%player_has_potioneffect_{}%", e), "==", "yes".into(), rc.outcome))
        }
        "gamemode" | "gm" => {
            // PlaceholderAPI Player expansion: %player_gamemode% → SURVIVAL / CREATIVE / ADVENTURE / SPECTATOR
            let modes: Vec<String> = rc
                .args
                .get("gm")
                .or_else(|| rc.args.get("ph"))
                .map(|v| {
                    v.split(',')
                        .map(|m| m.trim().to_ascii_uppercase())
                        .filter(|m| !m.is_empty())
                        .collect()
                })
                .unwrap_or_default();
            match (modes.len(), rc.outcome) {
                (0, _) => CondResult::Note(format!("Condition not understood: {}", c)),
                (1, o) => CondResult::Visible(visible_when("%player_gamemode%".into(), "==", modes[0].clone(), o)),
                // in none of the modes: "not A and not B"
                (_, false) => CondResult::Many(
                    modes
                        .into_iter()
                        .map(|m| visible_when("%player_gamemode%".into(), "==", m, false))
                        .collect(),
                ),
                (_, true) => CondResult::Note(format!("'in one of several game modes' can't be one condition - set it yourself: {}", c)),
            }
        }
        _ => CondResult::Note(format!("'{}' conditions are not supported yet: {}", rc.kind, c)),
    }
}

/// BetterHud `conditions:` map (first / second / operation / gate); visible while true
/// Every condition (all must hold, like BetterHud); the ones that can't be converted → notes
fn convert_betterhud_conditions(v: Option<&Y>) -> (Vec<Cond>, Vec<String>) {
    let items = entries(v);
    let mut notes = vec![];
    let mut out: Vec<Cond> = vec![];
    let mut skipped: Vec<String> = vec![];
    for (_, c) in items.iter() {
        let first = st(get(c, "first")).unwrap_or_default();
        let second = st(get(c, "second")).unwrap_or_default();
        let opname = st(get(c, "operation")).unwrap_or_default();
        let raw_val = second.trim().trim_matches('\'').trim_matches('"');
        let value = strip_bh_cast(raw_val).trim_matches('\'').trim_matches('"').to_string();
        // `dead == false`: the HUD is gone on the death screen anyway
        if first.trim() == "dead" && value == "false" && matches!(opname.trim(), "==" | "=") {
            continue;
        }
        let mut papi = papi_from_listener_value(&first);
        if !papi.starts_with('%') {
            if let Some(b) = betterhud_builtin(papi.trim()) {
                papi = b.to_string();
            }
        }
        match norm_op(&opname) {
            Some(op) if papi.starts_with('%') && !value.contains("papi:") && !value.contains('%') => {
                out.push(Cond { papi, op: op.to_string(), value });
            }
            _ => skipped.push(format!("{} {} {}", first, opname, second)),
        }
    }
    if !skipped.is_empty() {
        notes.push(format!("Condition not imported: {}", skipped.join("; ")));
    }
    (out, notes)
}

fn strip_mm_text(t: &str) -> ParsedText {
    parse_pattern(t, false)
}

fn parse_happy_mythic(vfs: &Vfs, root: &str, happy: bool, imgs: &mut ImageTable) -> (Vec<Hud>, Vec<String>, J) {
    let mut warns = vec![];
    let layouts = merge_dir(vfs, &format!("{}{}", root, if happy { "layout/" } else { "layouts/" }), &mut warns);
    let mut assets = merge_dir(vfs, &format!("{}assets/hud/", root), &mut warns);
    assets.extend(merge_dir(vfs, &format!("{}hud_assets/hud/", root), &mut warns));
    let listeners = merge_dir(vfs, &format!("{}listeners/", root), &mut warns);
    let config = load_yaml(vfs, &format!("{}config.yml", root));
    let defaults: BTreeSet<String> = config
        .as_ref()
        .and_then(|c| get(c, "layout"))
        .map(|l| str_list(get(l, "default")))
        .unwrap_or_default()
        .into_iter()
        .collect();
    let tex_base = vec![
        format!("{}textures/", root),
        format!("{}source-pack/assets/mythichud/textures/", root),
        format!("{}source-pack/assets/happyhud/textures/", root),
        root.to_string(),
    ];
    let mut out = vec![];

    for (lid, layout) in &layouts {
        let mut h = Hud { id: lid.clone(), name: lid.clone(), default: defaults.contains(lid), elements: vec![], notes: vec![] };
        for (eid, e) in entries(get(layout, "elements")) {
            let Some(aid) = st(get(e, "asset")) else { continue };
            let Some(asset) = assets.get(&aid) else {
                h.notes.push(format!("Asset '{}' was not found", aid));
                continue;
            };
            let (px, py) = xy(get(e, "position")).unwrap_or((0.0, 0.0));
            let (ox, oy) = xy(get(e, "offset")).unwrap_or((0.0, 0.0));
            let mut notes = vec![];
            // bottom-left origin → top-left percentages
            let sp = screen_point(px, 100.0 - py, &mut notes);
            h.notes.extend(notes);
            let ealign = st(get(e, "align")).unwrap_or_default().to_ascii_lowercase();

            // asset-level conditions -> Visibility Conditions on every layer
            let layer_listener = |key: &str| -> Option<String> {
                entries(get(asset, "layers"))
                    .into_iter()
                    .find(|(k, _)| k == key)
                    .and_then(|(_, ly)| get(ly, "function").and_then(|f| st(get(f, "listener"))))
            };
            let mut vis: Vec<Cond> = vec![];
            let mut asset_notes = vec![];
            for c in str_list(get(asset, "conditions")) {
                match convert_cond(&c, &layer_listener, &listeners) {
                    CondResult::Visible(v) => vis.push(v),
                    CondResult::Many(vs) => vis.extend(vs),
                    CondResult::Note(n) => asset_notes.push(n),
                }
            }

            // first pass: layer boxes in asset space (x right, y = top edge, up)
            struct L<'a> {
                key: String,
                y: &'a Y,
                left: f64,
                top_up: f64,
                w: f64,
                h: f64,
                img: Option<usize>,
                text: Option<ParsedText>,
                scale: f64,
                talign: &'static str,
            }
            let layer_list = entries(get(asset, "layers"));
            let n = layer_list.len();
            let mut ls: Vec<L> = vec![];
            for (lk, ly) in &layer_list {
                let (lx, lyy) = xy(get(ly, "offset")).unwrap_or((0.0, 0.0));
                let scale = num(get(ly, "scale")).unwrap_or(1.0);
                let align = st(get(ly, "align")).unwrap_or_default().to_ascii_lowercase();
                // HappyHUD layers align like normal text (right = right edge at x);
                // MythicHUD moves a layer *towards* its alignment (left = right edge at x)
                let place_x = |w: f64| match (happy, align.as_str()) {
                    (_, "center") => lx - w / 2.0,
                    (true, "right") => lx - w,
                    (false, "left") => lx - w,
                    _ => lx,
                };
                if let Some(tex) = get(ly, "texture") {
                    let p = st(get(tex, "path")).or_else(|| st(Some(tex))).unwrap_or_default();
                    let p = if p.contains('%') {
                        let fb = st(get(tex, "fallback"));
                        asset_notes.push(format!("Layer '{}' picks its picture from a placeholder — the fallback picture is used", lk));
                        fb.unwrap_or_default()
                    } else {
                        p
                    };
                    match vfs.resolve_png(&tex_base, &p) {
                        Some(path) => {
                            if let Some((img, w0, hh)) = imgs.add(vfs, &path) {
                                // alignment uses the picture's own width; `scale` then grows it from its left/top
                                let left = place_x(w0);
                                let (w, hh) = (w0 * scale, hh * scale);
                                ls.push(L { key: lk.clone(), y: ly, left, top_up: lyy, w, h: hh, img: Some(img), text: None, scale, talign: "left" });
                            }
                        }
                        None => h.notes.push(format!("Picture '{}' (asset '{}') is missing from the pack", p, aid)),
                    }
                } else if let Some(t) = st(get(ly, "text")) {
                    let pt = strip_mm_text(&t);
                    let w = (pt.plain_len as f64 * 6.0 * scale).max(4.0);
                    let hh = 9.0 * scale;
                    // where the text is anchored, so values of any width stay aligned
                    let talign = match (happy, align.as_str()) {
                        (_, "center") => "center",
                        (true, "right") | (false, "left") => "right",
                        _ => "left",
                    };
                    ls.push(L { key: lk.clone(), y: ly, left: place_x(w), top_up: lyy, w, h: hh, img: None, text: Some(pt), scale, talign });
                } else if let Some(head) = get(ly, "head") {
                    let s = num(get(head, "size")).unwrap_or(1.0) * 8.0;
                    ls.push(L { key: lk.clone(), y: ly, left: place_x(s), top_up: lyy, w: s, h: s, img: None, text: None, scale, talign: "left" });
                }
            }
            if ls.is_empty() {
                continue;
            }
            // asset bounding box from pictures (texts are estimates, used only as fallback)
            let boxes: Vec<&L> = if ls.iter().any(|l| l.img.is_some()) { ls.iter().filter(|l| l.img.is_some()).collect() } else { ls.iter().collect() };
            let min_l = boxes.iter().map(|l| l.left).fold(f64::INFINITY, f64::min);
            let max_r = boxes.iter().map(|l| l.left + l.w).fold(f64::NEG_INFINITY, f64::max);
            let shift_x = match ealign.as_str() {
                "left" => ox - max_r,
                "center" => ox - (min_l + max_r) / 2.0,
                _ => ox - min_l,
            };

            // emit bottom-to-top so base bars (e.g. normal HP/Food) claim the native bar type
            // before conditional status-effect overlays sitting above them
            for (idx, l) in ls.iter().enumerate().rev() {
                let order = layer_list.iter().position(|(k, _)| *k == l.key).unwrap_or(idx);
                let layer = (n - order) as f64;
                let left = shift_x + l.left;
                let top = -(oy + l.top_up);
                let (anchor, offset, size) = place(&sp, left, top, l.w, l.h);
                let mut notes = asset_notes.clone();
                let mut own: Vec<Cond> = vec![];
                for c in str_list(get(l.y, "conditions")) {
                    match convert_cond(&c, &layer_listener, &listeners) {
                        CondResult::Visible(v) => own.push(v),
                        CondResult::Many(vs) => own.extend(vs),
                        CondResult::Note(n) => notes.push(n),
                    }
                }
                let (mut visibility, mut visibility_extra) = vis_fields(own.iter().chain(vis.iter()));
                if l.text.is_some() && !visibility.is_null() {
                    notes.push("Scoreboard texts can't be hidden by a condition in the Bedrock export - this text is always shown".into());
                    visibility = J::Null;
                    visibility_extra = J::Array(vec![]);
                }
                let key = format!("{}/{}/{}", aid, eid, l.key);
                let name = format!("{}_{}", aid, l.key);
                if let Some(img) = l.img {
                    let mut bar = J::Null;
                    if let Some(f) = get(l.y, "function") {
                        let lname = st(get(f, "listener")).unwrap_or_default();
                        let vertical = st(get(f, "orientation")).map(|o| o.eq_ignore_ascii_case("vertical")).unwrap_or(false);
                        let reversed = boolean(get(f, "reversed")).unwrap_or(false);
                        let direction = match (vertical, reversed) {
                            (false, false) => "left",
                            (false, true) => "right",
                            (true, false) => "bottom",
                            (true, true) => "top",
                        };
                        let steps = num(get(f, "increment")).unwrap_or(16.0);
                        if get(l.y, "texture").and_then(|t| st(get(t, "type"))).map(|t| t == "repeated").unwrap_or(false) {
                            notes.push("Repeated-icon bar — imported as a normal bar".into());
                        }
                        bar = if let Some(t) = vanilla_bar(&lname) {
                            bar_json(t, "", "", direction, steps)
                        } else if let Some(def) = listeners
                            .get(&lname)
                            .or_else(|| listeners.iter().find(|(k, _)| squash(k) == squash(&lname)).map(|(_, v)| v))
                        {
                            let v = st(get(def, "value")).unwrap_or_default();
                            let m = st(get(def, "max")).unwrap_or_default();
                            if v.contains("parseother") {
                                notes.push("Bar reads another player's value (parseother) — needs PlaceholderAPI parseother on the server".into());
                            }
                            bar_json("custom", &v, &m, direction, steps)
                        } else {
                            notes.push(format!("Unknown bar listener '{}' — set the placeholder yourself", lname));
                            bar_json("custom", "", "", direction, steps)
                        };
                    }
                    let color = st(get(l.y, "color")).and_then(|c| named_color(&c).map(|s| s.to_string()).or(Some(c))).and_then(|c| hex_to_rgb(&c));
                    h.elements.push(json!({
                        "kind": if bar.is_null() { "image" } else { "bar" },
                        "name": name, "key": key, "image": img,
                        "anchor": anchor, "offset": offset, "size": size, "layer": layer,
                        "bar": bar, "tint": color, "visibility": visibility, "visibility_extra": visibility_extra, "notes": notes_json(notes),
                    }));
                } else if let Some(pt) = &l.text {
                    notes.extend(pt.notes.clone());
                    if pt.papi.contains("%arg-") {
                        notes.push("Pop-up argument text (%arg-N%) has no Bedrock equivalent".into());
                    }
                    let color = pt.color.clone().or_else(|| st(get(l.y, "color"))).and_then(|c| named_color(&c).map(|s| s.to_string()).or(Some(c)));
                    let offset = text_point(&sp, left, top, l.w, l.h, l.talign);
                    h.elements.push(json!({
                        "kind": "text", "name": name, "key": key,
                        "anchor": anchor, "offset": offset, "size": size, "layer": layer,
                        "text": {
                            "papi": pt.papi, "source": st(get(l.y, "text")), "align": l.talign,
                            "color": color.as_deref().and_then(hex_to_rgb),
                            "fontSize": font_size_for(l.scale),
                            "shadow": boolean(get(l.y, "outlined")).unwrap_or(false) || get(l.y, "shadow").is_some(),
                        },
                        "visibility": visibility, "visibility_extra": visibility_extra, "notes": notes_json(notes),
                    }));
                } else {
                    h.elements.push(json!({
                        "kind": "head", "name": name, "key": key,
                        "anchor": anchor, "offset": offset, "size": size, "layer": layer,
                        "visibility": visibility, "visibility_extra": visibility_extra, "notes": notes_json(notes),
                    }));
                }
            }
        }
        if !h.elements.is_empty() || !h.notes.is_empty() {
            out.push(h);
        }
    }
    if vfs.has_yaml_under(&format!("{}popups/", root)) || vfs.has_yaml_under(&format!("{}popup/", root)) {
        warns.push("Pop-ups were not imported (no Bedrock equivalent yet)".into());
    }
    (out, warns, J::Null)
}

/* ───────────────────────── hotbar calibration ───────────────────────── */

/// Finds a hotbar frame (an empty ≥180×18 hole in a bottom-centre picture) and returns
/// how far the pack's bottom elements must move so the hole sits on the real hotbar.
fn hotbar_hole_shift(vfs: &Vfs, images: &[J], huds: &[Hud]) -> Option<(f64, String)> {
    for h in huds {
        for e in &h.elements {
            if e["kind"] != "image" || e["anchor"] != "bottom_middle" {
                continue;
            }
            let ew = e["size"][0].as_f64()?;
            let eh = e["size"][1].as_f64()?;
            if ew < 182.0 {
                continue;
            }
            let id = e["image"].as_u64()? as usize;
            let path = images.get(id)?["path"].as_str()?;
            let Ok(img) = image::load_from_memory(vfs.get(path)?) else { continue };
            let img = img.to_rgba8();
            let (iw, ih) = img.dimensions();
            let s = ew / iw as f64;
            let cx = (e["offset"][0].as_f64()? * -1.0 + ew / 2.0) / s; // screen centre in image px
            let half = 88.0 / s;
            let (x0, x1) = ((cx - half).max(0.0) as u32, ((cx + half) as u32).min(iw - 1));
            if x1 <= x0 + 10 {
                continue;
            }
            let clear = |y: u32| (x0..=x1).all(|x| img.get_pixel(x, y)[3] < 40);
            // lowest run of clear rows that is at least 18 GUI px tall
            let mut y = ih as i64 - 1;
            while y >= 0 {
                if clear(y as u32) {
                    let end = y;
                    while y >= 0 && clear(y as u32) {
                        y -= 1;
                    }
                    let run = (end - y) as f64 * s;
                    if run >= 18.0 && run <= 40.0 {
                        let hole_mid = (y + 1 + end + 1) as f64 / 2.0 * s;
                        let top = e["offset"][1].as_f64()? - eh; // y-down, from the bottom edge
                        let dy = HOTBAR_MID - (top + hole_mid);
                        if dy.abs() >= 0.5 && dy.abs() <= 48.0 {
                            return Some((r2(dy), e["name"].as_str().unwrap_or("").to_string()));
                        }
                        return None;
                    }
                } else {
                    y -= 1;
                }
            }
        }
    }
    None
}

/// Corner-anchored items that land on the vanilla hotbar on the 480×270 reference screen
fn hotbar_overlaps(huds: &mut [Hud]) {
    let (hx0, hx1, hy0) = (REF_W / 2.0 - 91.0, REF_W / 2.0 + 91.0, REF_H + HOTBAR_LIFT - 22.0);
    for h in huds {
        for e in &mut h.elements {
            let a = e["anchor"].as_str().unwrap_or("");
            if (a != "bottom_left" && a != "bottom_right") || e["kind"] == "text" {
                continue;
            }
            let (fx, _) = if a == "bottom_left" { (0.0, 1.0) } else { (1.0, 1.0) };
            let (w, hh) = (e["size"][0].as_f64().unwrap_or(0.0), e["size"][1].as_f64().unwrap_or(0.0));
            let x = REF_W * fx + e["offset"][0].as_f64().unwrap_or(0.0) - w * fx;
            let y = REF_H + e["offset"][1].as_f64().unwrap_or(0.0) - hh;
            if x < hx1 && x + w > hx0 && y + hh > hy0 {
                if let Some(n) = e["notes"].as_array_mut() {
                    n.push(J::from("Covers the hotbar on a 480-wide screen (it is placed from the screen corner) — move it after import"));
                }
            }
        }
    }
}

/// Screen box (x, y, w, h) on the reference screen; texts use their estimated size
fn screen_box(e: &J) -> Option<(f64, f64, f64, f64)> {
    let a = e["anchor"].as_str()?;
    let (fx, fy) = match a {
        "center" => (0.5, 0.5),
        _ => {
            let (v, h) = a.split_once('_')?;
            let f = |s: &str| match s { "left" | "top" => 0.0, "middle" => 0.5, _ => 1.0 };
            (f(h), f(v))
        }
    };
    let (w, h) = (e["size"][0].as_f64()?, e["size"][1].as_f64()?);
    let (ox, oy) = (e["offset"][0].as_f64()?, e["offset"][1].as_f64()?);
    if e["kind"] == "text" {
        let al = e["text"]["align"].as_str().unwrap_or("left");
        let px = REF_W * fx + ox;
        let py = REF_H * fy + oy;
        let x = match al { "right" => px - w, "center" => px - w / 2.0, _ => px };
        let y = if al == "center" { py - h / 2.0 } else { py };
        return Some((x, y, w, h));
    }
    Some((REF_W * fx + ox - w * fx, REF_H * fy + oy - h * fy, w, h))
}

/// Bedrock keeps three 18×18 buttons at the top centre (drawn by the editor too).
/// A HUD whose top items would cover them is moved down below them.
fn clear_top_buttons(huds: &mut [Hud]) {
    let (x0, x1, bottom) = (REF_W / 2.0 - 28.0, REF_W / 2.0 + 28.0, 21.0);
    for h in huds {
        let mut need: f64 = 0.0;
        for e in &h.elements {
            if !e["anchor"].as_str().map(|a| a.starts_with("top")).unwrap_or(false) {
                continue;
            }
            if let Some((x, y, w, hh)) = screen_box(e) {
                if x < x1 && x + w > x0 && y < bottom && y + hh > 0.0 {
                    need = need.max(bottom - y);
                }
            }
        }
        if need > 0.0 {
            for e in &mut h.elements {
                if e["anchor"].as_str().map(|a| a.starts_with("top")).unwrap_or(false) {
                    let y = e["offset"][1].as_f64().unwrap_or(0.0);
                    e["offset"][1] = J::from(r2(y + need));
                }
            }
            h.notes.push(format!("Moved down {} px so it does not cover the Bedrock buttons at the top centre", r2(need)));
        }
    }
}

fn shift_bottom(huds: &mut [Hud], dy: f64) {
    for h in huds {
        for e in &mut h.elements {
            if e["anchor"].as_str().map(|a| a.starts_with("bottom")).unwrap_or(false) {
                let y = e["offset"][1].as_f64().unwrap_or(0.0);
                e["offset"][1] = J::from(r2(y + dy));
            }
        }
    }
}

/* ───────────────────────── CustomNameplates boss bar ───────────────────────── */

/// A font image (ItemsAdder `font_images` / Oraxen or Nexo `glyphs`)
struct Glyph {
    png: String,
    height: f64,
    ascent: f64,
    quad_w: f64,
    advance: f64,
}

fn glyph_metrics(bytes: &[u8], height: f64) -> Option<(f64, f64)> {
    let (pw, ph) = png_size(bytes)?;
    let actual_w = match image::load_from_memory(bytes) {
        Ok(im) => {
            let rgba = im.to_rgba8();
            (0..pw)
                .rev()
                .find(|&x| (0..ph).any(|y| rgba.get_pixel(x, y)[3] > 0))
                .map(|x| (x + 1) as f64)
                .unwrap_or(0.0)
        }
        Err(_) => pw as f64,
    };
    let scale = height / (ph as f64).max(1.0);
    Some((pw as f64 * scale, (actual_w * scale).floor() + 1.0))
}

/// Minecraft default font advance of one character (bitmap width + 1)
fn mc_char_width(c: char) -> f64 {
    match c {
        ' ' => 4.0,
        'i' | '!' | '.' | ',' | ':' | ';' | '|' | '\'' => 2.0,
        'l' | '`' => 3.0,
        't' | 'I' | '[' | ']' | '"' | '(' | ')' | '*' | '{' | '}' => 4.0,
        'f' | 'k' | '<' | '>' => 5.0,
        '@' | '~' => 7.0,
        _ => 6.0,
    }
}

/// What a placeholder probably shows, to estimate how wide the text is on a centred boss bar
fn sample_of(papi: &str) -> &'static str {
    let p = papi.to_ascii_lowercase();
    if p.contains("season") {
        "Spring"
    } else if p.contains("time") {
        "12:00"
    } else if p.contains("date") || p.contains("day") {
        "Day 12"
    } else if p.contains("name") {
        "Steve"
    } else if p.contains("balance") || p.contains("money") {
        "1,250"
    } else {
        "000000"
    }
}

fn text_width(t: &str) -> f64 {
    let mut w = 0.0;
    let mut rest = t;
    while !rest.is_empty() {
        if let Some(stripped) = rest.strip_prefix('%') {
            if let Some(end) = stripped.find('%') {
                w += sample_of(&stripped[..end]).chars().map(mc_char_width).sum::<f64>();
                rest = &stripped[end + 1..];
                continue;
            }
        }
        let c = rest.chars().next().unwrap();
        w += mc_char_width(c);
        rest = &rest[c.len_utf8()..];
    }
    w
}

/// `namespace:path` of a font texture → the PNG in the pack (`assets/<ns>/textures/<path>.png`)
fn font_texture(vfs: &Vfs, root: &str, ns_hint: Option<&str>, tex: &str) -> Option<String> {
    let (ns, path) = match tex.split_once(':') {
        Some((n, p)) => (n.trim(), p.trim()),
        None => (ns_hint.unwrap_or("minecraft"), tex.trim()),
    };
    let path = path.trim_end_matches(".png");
    let tails = [
        format!("assets/{}/textures/{}.png", ns, path).to_ascii_lowercase(),
        format!("pack/{}/textures/{}.png", ns, path).to_ascii_lowercase(),
    ];
    for k in vfs.files.keys() {
        if k.starts_with(root) {
            let kl = k.to_ascii_lowercase();
            if tails.iter().any(|t| kl.ends_with(t)) {
                return Some(k.clone());
            }
        }
    }
    None
}

fn hex_or_named(tag: &str) -> Option<String> {
    if let Some(h) = tag.strip_prefix('#') {
        if h.len() == 6 && h.chars().all(|c| c.is_ascii_hexdigit()) {
            return Some(format!("#{}", h.to_ascii_uppercase()));
        }
        return None;
    }
    let t = tag.strip_prefix("color:").or_else(|| tag.strip_prefix("c:")).unwrap_or(tag);
    named_color(t).map(|c| c.to_string()).or_else(|| if t.starts_with('#') { hex_or_named(t) } else { None })
}

/// One piece of the boss bar line, laid out from the left end (x) and the line's baseline
enum NpPiece {
    Image { glyph: String, x: f64, vis: Vec<Cond> },
    Text { text: String, x: f64, w: f64, ascent: f64, color: Option<String>, vis: Vec<Cond> },
}

struct NpCtx<'a> {
    glyphs: &'a HashMap<String, Glyph>,
    fonts: &'a HashMap<String, f64>,
    conditional: &'a IndexMap<String, Y>,
    notes: Vec<String>,
}

/// Walks a CustomNameplates text, moving x like the client does; returns the end x
fn np_walk(ctx: &mut NpCtx, text: &str, mut x: f64, vis: &[Cond], out: &mut Vec<NpPiece>, depth: u32) -> f64 {
    let mut ascent = 7.0;
    let mut color: Option<String> = None;
    let mut run = String::new();
    let mut run_x = x;
    let flush = |run: &mut String, run_x: f64, x: f64, ascent: f64, color: &Option<String>, out: &mut Vec<NpPiece>| {
        if !run.trim().is_empty() {
            let lead = &run[..run.len() - run.trim_start().len()];
            let trail = &run[run.trim_end().len()..];
            let lx = run_x + text_width(lead);
            let rw = (x - run_x - text_width(lead) - text_width(trail)).max(4.0);
            out.push(NpPiece::Text {
                text: run.trim().to_string(),
                x: lx,
                w: rw,
                ascent,
                color: color.clone(),
                vis: vis.to_vec(),
            });
        }
        run.clear();
    };
    let mut rest = text;
    while !rest.is_empty() {
        // legacy `&` / `§` colour codes
        if rest.starts_with('&') || rest.starts_with('§') {
            let pfx = rest.chars().next().unwrap().len_utf8();
            let after = &rest[pfx..];
            if let Some(n) = after.chars().next() {
                if n == '#' && after.len() >= 7 && after[1..7].chars().all(|c| c.is_ascii_hexdigit()) {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    color = Some(format!("#{}", after[1..7].to_ascii_uppercase()));
                    run_x = x;
                    rest = &after[7..];
                    continue;
                }
                if let Some(col) = legacy_color(n) {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    color = Some(col.to_string());
                    run_x = x;
                    rest = &after[n.len_utf8()..];
                    continue;
                }
                if "klmnorKLMNOR".contains(n) {
                    if n.eq_ignore_ascii_case(&'r') {
                        flush(&mut run, run_x, x, ascent, &color, out);
                        color = None;
                        run_x = x;
                    }
                    rest = &after[n.len_utf8()..];
                    continue;
                }
            }
        }
        // `<font:ns:name> … </font>`, MiniMessage colours
        if rest.starts_with('<') {
            if let Some(end) = rest.find('>') {
                let tag = rest[1..end].trim();
                let tl = tag.to_ascii_lowercase();
                let mut handled = true;
                if let Some(f) = tl.strip_prefix("font:") {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    ascent = ctx.fonts.get(f).copied().unwrap_or(7.0);
                    run_x = x;
                } else if tl == "/font" {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    ascent = 7.0;
                    run_x = x;
                } else if let Some(c) = hex_or_named(&tl) {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    color = Some(c);
                    run_x = x;
                } else if tl == "reset" || (tl.starts_with('/') && hex_or_named(&tl[1..]).is_some()) {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    color = None;
                    run_x = x;
                } else if tl.starts_with('/') || matches!(tl.as_str(), "bold" | "italic" | "b" | "i" | "underlined" | "u" | "strikethrough" | "st" | "obfuscated" | "obf") {
                } else {
                    handled = false;
                }
                if handled {
                    rest = &rest[end + 1..];
                    continue;
                }
            }
        }
        if rest.starts_with('%') {
            if let Some(end) = rest[1..].find('%') {
                let ph = &rest[1..end + 1];
                let pl = ph.to_ascii_lowercase();
                let shift = if let Some(n) = pl.strip_prefix("img_offset_") {
                    n.parse::<f64>().ok()
                } else if let Some(n) = pl.strip_prefix("oraxen_neg_shift_") {
                    n.parse::<f64>().ok().map(|v| -v)
                } else if let Some(n) = pl.strip_prefix("oraxen_shift_") {
                    n.parse::<f64>().ok()
                } else if let Some(n) = pl.strip_prefix("nexo_neg_shift_") {
                    n.parse::<f64>().ok().map(|v| -v)
                } else if let Some(n) = pl.strip_prefix("nexo_shift_") {
                    n.parse::<f64>().ok()
                } else {
                    None
                };
                if let Some(d) = shift {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    x += d;
                    run_x = x;
                    rest = &rest[end + 2..];
                    continue;
                }
                let glyph = ["img_", "oraxen_", "nexo_", "itemsadder_"]
                    .iter()
                    .find_map(|p| pl.strip_prefix(p))
                    .filter(|g| ctx.glyphs.contains_key(*g));
                if let Some(g) = glyph {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    let gl = &ctx.glyphs[g];
                    out.push(NpPiece::Image { glyph: g.to_string(), x, vis: vis.to_vec() });
                    x += gl.advance;
                    run_x = x;
                    rest = &rest[end + 2..];
                    continue;
                }
                if let Some(key) = pl.strip_prefix("conditionaltext_") {
                    flush(&mut run, run_x, x, ascent, &color, out);
                    if let Some(def) = ctx.conditional.get(key).cloned() {
                        if depth < 3 {
                            let ph2 = st(get(&def, "placeholder")).unwrap_or_default();
                            let mut adv: Option<f64> = None;
                            for rule in str_list(get(&def, "rules")) {
                                // "=Value;text" (also "!=", ">=", "<=", ">", "<", "default;text")
                                let Some((cond, body)) = rule.split_once(';') else { continue };
                                let cond = cond.trim();
                                let (op, val) = ["!=", ">=", "<=", "==", "=", ">", "<"]
                                    .iter()
                                    .find_map(|o| cond.strip_prefix(o).map(|v| (*o, v.trim())))
                                    .unwrap_or(("==", cond));
                                let op = if op == "=" { "==" } else { op };
                                let mut v2 = vis.to_vec();
                                if !ph2.is_empty() && !cond.eq_ignore_ascii_case("default") {
                                    v2.push(Cond { papi: ph2.clone(), op: op.to_string(), value: val.to_string() });
                                }
                                let end_x = np_walk(ctx, body, x, &v2, out, depth + 1);
                                adv.get_or_insert(end_x - x);
                            }
                            x += adv.unwrap_or(0.0);
                        }
                    } else {
                        ctx.notes.push(format!("%conditionaltext_{}% is not defined in ConditionalTextPlaceholders", key));
                    }
                    run_x = x;
                    rest = &rest[end + 2..];
                    continue;
                }
                // any other placeholder is part of the visible text
                if run.is_empty() {
                    run_x = x;
                }
                run.push_str(&rest[..end + 2]);
                x += text_width(&rest[..end + 2]);
                rest = &rest[end + 2..];
                continue;
            }
        }
        let c = rest.chars().next().unwrap();
        if run.is_empty() {
            run_x = x;
        }
        run.push(c);
        x += mc_char_width(c);
        rest = &rest[c.len_utf8()..];
    }
    flush(&mut run, run_x, x, ascent, &color, out);
    x
}

fn parse_nameplates(vfs: &Vfs, root: &str, imgs: &mut ImageTable) -> (Vec<Hud>, Vec<String>, J) {
    let mut warns = vec![];
    // font images: ItemsAdder `font_images` (`path`, `scale_ratio` = height, `y_position` = ascent) and Oraxen/Nexo `glyphs`
    let mut glyphs: HashMap<String, Glyph> = HashMap::new();
    for (path, bytes) in vfs.under(root) {
        if !is_yaml(path) {
            continue;
        }
        let Ok(y) = parse_yaml(bytes) else { continue };
        let ns_hint = get(&y, "info").and_then(|i| st(get(i, "namespace")));
        let mut add = |name: String, tex: Option<String>, h: Option<f64>, a: Option<f64>| {
            let Some(tex) = tex else { return };
            let Some(png) = font_texture(vfs, root, ns_hint.as_deref(), &tex) else { return };
            let height = h.unwrap_or(8.0);
            let Some(png_bytes) = vfs.get(&png) else { return };
            let Some((quad_w, advance)) = glyph_metrics(png_bytes, height) else { return };
            glyphs.entry(name.to_ascii_lowercase()).or_insert(Glyph {
                png,
                height,
                ascent: a.unwrap_or(7.0),
                quad_w,
                advance,
            });
        };
        for (name, g) in entries(get(&y, "font_images")) {
            add(name, st(get(g, "path")), num(get(g, "scale_ratio")), num(get(g, "y_position")));
        }
        if path.to_ascii_lowercase().contains("/glyphs/") {
            for (name, g) in entries(Some(&y)) {
                add(name, st(get(g, "texture")), num(get(g, "height")), num(get(g, "ascent")));
            }
        }
    }
    // custom fonts (`assets/<ns>/font/<name>.json`): `ascent` moves text vertically (e.g. two stacked text slots)
    let mut fonts: HashMap<String, f64> = HashMap::new();
    for (path, bytes) in vfs.under(root) {
        let l = path.to_ascii_lowercase();
        let Some(i) = l.find("/assets/").map(|i| i + 1).or(if l.starts_with("assets/") { Some(0) } else { None }) else { continue };
        let rel = &l[i + "assets/".len()..];
        let Some((ns, rest)) = rel.split_once("/font/") else { continue };
        let Some(name) = rest.strip_suffix(".json") else { continue };
        let Ok(v) = serde_json::from_slice::<J>(bytes) else { continue };
        if let Some(a) = v["providers"].as_array().and_then(|p| p.iter().find_map(|x| x["ascent"].as_f64())) {
            fonts.insert(format!("{}:{}", ns, name), a);
        }
    }
    let mut conditional: IndexMap<String, Y> = IndexMap::new();
    for (path, bytes) in vfs.under(root) {
        if is_yaml(path) && path.to_ascii_lowercase().contains("conditionaltextplaceholders/") {
            if let Ok(Y::Mapping(m)) = parse_yaml(bytes) {
                for (k, v) in m {
                    conditional.insert(key_str(&k).to_ascii_lowercase(), v);
                }
            }
        }
    }
    let mut bars_map: IndexMap<String, Y> = IndexMap::new();
    let want_single = format!("{}customnameplates/configs/bossbar.yml", root).to_ascii_lowercase();
    let want_dir = format!("{}customnameplates/configs/bossbars/", root).to_ascii_lowercase();
    for (path, bytes) in vfs.under(root) {
        let pl = path.to_ascii_lowercase();
        if is_yaml(path) && (pl == want_single || pl.starts_with(&want_dir)) {
            if let Ok(Y::Mapping(m)) = parse_yaml(bytes) {
                for (k, v) in m {
                    bars_map.insert(key_str(&k), v);
                }
            }
        }
    }
    let mut out = vec![];
    // Boss bar title: centred on the screen, top of the line at y 3, baseline at y 10
    const LINE_TOP: f64 = 3.0;
    const BASELINE: f64 = LINE_TOP + 7.0;
    for (id, bar) in &bars_map {
        let texts = {
            let mut t = str_list(get(bar, "dynamic-text"));
            if t.is_empty() {
                t = str_list(get(bar, "text"));
            }
            t
        };
        let Some(line) = texts.first() else { continue };
        let mut ctx = NpCtx { glyphs: &glyphs, fonts: &fonts, conditional: &conditional, notes: vec![] };
        let mut pieces = vec![];
        let total = np_walk(&mut ctx, line, 0.0, &[], &mut pieces, 0);
        if pieces.is_empty() {
            continue;
        }
        let mut h = Hud { id: id.clone(), name: id.clone(), default: true, elements: vec![], notes: ctx.notes };
        if texts.len() > 1 {
            h.notes.push(format!("{} lines of dynamic text: only the first is imported", texts.len()));
        }
        // Check horizontal bounds relative to screen centre: CustomNameplates packs often use a huge
        // %img_offset_440% to push a HUD to the top-right of a 640-wide (GUI scale 3) screen, which
        // goes off the right edge of a 480-wide screen unless anchored to that corner.
        let left0 = -total / 2.0;
        let mut min_x = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        for p in &pieces {
            let (px, pw) = match p {
                NpPiece::Image { glyph, x, .. } => (*x, glyphs[glyph].quad_w),
                NpPiece::Text { x, w, .. } => (*x, *w),
            };
            min_x = min_x.min(left0 + px);
            max_x = max_x.max(left0 + px + pw);
        }
        let mut nsp_notes = vec![];
        let (sp, base_left) = if min_x > 0.0 && max_x > REF_W / 2.0 - 4.0 {
            h.notes.push("CustomNameplates boss bar uses a large positive offset (made for a wider GUI scale) — anchored to top_right so it stays on screen".into());
            (screen_point(100.0, 0.0, &mut nsp_notes), left0 - max_x - 6.0)
        } else if max_x < 0.0 && min_x < -(REF_W / 2.0 - 4.0) {
            h.notes.push("CustomNameplates boss bar uses a large negative offset (made for a wider GUI scale) — anchored to top_left so it stays on screen".into());
            (screen_point(0.0, 0.0, &mut nsp_notes), left0 - min_x + 6.0)
        } else {
            h.notes.push("CustomNameplates boss bar: centred at the top of the screen like the game's boss bar title; text widths are estimated".into());
            (screen_point(50.0, 0.0, &mut nsp_notes), left0)
        };
        for (n, p) in pieces.iter().enumerate() {
            match p {
                NpPiece::Image { glyph, x, vis } => {
                    let g = &glyphs[glyph];
                    let Some((img, _, _)) = imgs.add(vfs, &g.png) else { continue };
                    let top = BASELINE - g.ascent;
                    let (anchor, offset, size) = place(&sp, base_left + x, top, g.quad_w, g.height);
                    let (v, vx) = vis_fields(vis.iter());
                    h.elements.push(json!({
                        "kind": "image", "name": glyph, "key": format!("{}/{}/{}", id, n, glyph),
                        "image": img, "anchor": anchor, "offset": offset, "size": size,
                        "layer": n as f64, "bar": J::Null, "visibility": v, "visibility_extra": vx, "notes": [],
                    }));
                }
                NpPiece::Text { text, x, w, ascent, color, vis } => {
                    let top = BASELINE - ascent;
                    let th = 9.0;
                    let (anchor, _, size) = place(&sp, base_left + x, top, *w, th);
                    let offset = text_point(&sp, base_left + x, top, *w, th, "left");
                    let mut notes = vec![];
                    if !vis.is_empty() {
                        notes.push("Scoreboard texts can't be hidden by a condition in the Bedrock export - this text is always shown".to_string());
                    }
                    if text.to_ascii_lowercase().contains("%nameplates_") {
                        notes.push("Uses a %nameplates_…% placeholder — requires CustomNameplates on the server, or change it to another PAPI placeholder (e.g. %localtime_time_HH:mm%)".to_string());
                    }
                    h.elements.push(json!({
                        "kind": "text", "name": format!("{}_text_{}", id, n), "key": format!("{}/{}/text", id, n),
                        "anchor": anchor, "offset": offset, "size": size, "layer": n as f64,
                        "text": {
                            "papi": text, "source": text, "align": "left",
                            "color": color.as_deref().and_then(hex_to_rgb),
                            "fontSize": font_size_for(1.0), "shadow": false,
                        },
                        "notes": notes_json(notes),
                    }));
                }
            }
        }
        if !h.elements.is_empty() {
            out.push(h);
        }
    }
    if out.is_empty() {
        warns.push("CustomNameplates bossbar.yml has no boss bar with dynamic text".into());
    }
    (out, warns, J::Null)
}

/* ───────────────────────── detection ───────────────────────── */

#[derive(Debug, Clone, Copy, PartialEq)]
enum Plugin {
    BetterHud,
    HappyHud,
    MythicHud,
    /// CustomNameplates boss bar: one line of font images and text moved with offset glyphs
    Nameplates,
}

impl Plugin {
    fn id(self) -> &'static str {
        match self {
            Plugin::BetterHud => "betterhud",
            Plugin::HappyHud => "happyhud",
            Plugin::MythicHud => "mythichud",
            Plugin::Nameplates => "customnameplates",
        }
    }
    fn label(self) -> &'static str {
        match self {
            Plugin::BetterHud => "BetterHud",
            Plugin::HappyHud => "HappyHUD",
            Plugin::MythicHud => "MythicHUD",
            Plugin::Nameplates => "CustomNameplates",
        }
    }
}

/// Plugin roots, identified by which config folders sit next to each other
/// `(base root, overlay root)`: a BetterHud folder that has only `layouts/` (packs ship
/// "drag V.2 over V.1" add-ons like that) used on top of the full root it shares most
/// layout names with
fn detect_overlays(vfs: &Vfs, roots: &[(String, Plugin)]) -> Vec<(String, String)> {
    let full: Vec<&String> = roots.iter().filter(|(_, p)| *p == Plugin::BetterHud).map(|(r, _)| r).collect();
    if full.is_empty() {
        return vec![];
    }
    let mut cands: BTreeSet<String> = BTreeSet::new();
    for k in vfs.files.keys() {
        if !is_yaml(k) {
            continue;
        }
        let probe = format!("/{}", k);
        if let Some(i) = probe.find("/layouts/") {
            cands.insert(probe[1..i + 1].to_string());
        }
    }
    let names = |root: &str| -> BTreeSet<String> {
        let mut w = vec![];
        merge_dir(vfs, &format!("{}layouts/", root), &mut w).into_keys().collect()
    };
    let mut out = vec![];
    for o in cands {
        if roots.iter().any(|(r, _)| *r == o) {
            continue;
        }
        let has = |d: &str| vfs.has_yaml_under(&format!("{}{}", o, d));
        if has("huds/") || has("images/") || has("assets/hud/") || has("hud_assets/hud/") {
            continue;
        }
        let mine = names(&o);
        if mine.is_empty() {
            continue;
        }
        let best = full
            .iter()
            .map(|r| (names(r).intersection(&mine).count(), *r))
            .max_by_key(|(n, _)| *n);
        if let Some((n, base)) = best {
            if n * 2 >= mine.len() {
                out.push((base.clone(), o));
            }
        }
    }
    out
}

fn detect_roots(vfs: &Vfs) -> Vec<(String, Plugin)> {
    let mut cands: BTreeSet<String> = BTreeSet::new();
    for k in vfs.files.keys() {
        if !is_yaml(k) {
            continue;
        }
        for marker in ["huds/", "layouts/", "layout/"] {
            let probe = format!("/{}", k);
            if let Some(i) = probe.find(&format!("/{}", marker)) {
                cands.insert(probe[1..i + 1].to_string());
            }
        }
    }
    let mut out = vec![];
    // CustomNameplates: <root>CustomNameplates/configs/bossbar.yml (or bossbars/*.yml)
    let mut np_roots: BTreeSet<String> = BTreeSet::new();
    for k in vfs.files.keys() {
        if !is_yaml(k) {
            continue;
        }
        let l = format!("/{}", k.to_ascii_lowercase());
        if let Some(i) = l.find("/customnameplates/configs/bossbar.yml") {
            if i + "/customnameplates/configs/bossbar.yml".len() == l.len() {
                np_roots.insert(k[..i].to_string());
            }
        } else if let Some(i) = l.find("/customnameplates/configs/bossbars/") {
            np_roots.insert(k[..i].to_string());
        }
    }
    for r in np_roots {
        out.push((r, Plugin::Nameplates));
    }
    for root in cands {
        let has = |d: &str| vfs.has_yaml_under(&format!("{}{}", root, d));
        if has("huds/") && has("layouts/") && has("images/") {
            out.push((root, Plugin::BetterHud));
        } else if has("layout/") && (has("assets/hud/") || has("hud_assets/hud/")) {
            out.push((root, Plugin::HappyHud));
        } else if has("layouts/") && (has("assets/hud/") || has("hud_assets/hud/")) {
            let happy = load_yaml(vfs, &format!("{}config.yml", root)).is_some()
                && String::from_utf8_lossy(vfs.get(&format!("{}config.yml", root)).unwrap()).contains("HappyHud");
            out.push((root, if happy { Plugin::HappyHud } else { Plugin::MythicHud }));
        }
    }
    out
}

fn has_visible_hotbar(bytes: &[u8], legacy: bool) -> bool {
    let Ok(img) = image::load_from_memory(bytes) else { return false };
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    if legacy {
        if w < 256 || w != h {
            return false;
        }
        let s = w as f64 / 256.0;
        let (bw, bh) = ((182.0 * s).round() as u32, (22.0 * s).round() as u32);
        (0..bh.min(h)).any(|y| (0..bw.min(w)).any(|x| rgba.get_pixel(x, y)[3] > 0))
    } else {
        let borderless = w % 180 == 0 && h % 20 == 0 && w / 180 == h / 20;
        let full = w >= 182 && (h as f64 / (w as f64 / 182.0) - 22.0).abs() <= 1.0;
        if !borderless && !full {
            return false;
        }
        rgba.pixels().any(|p| p[3] > 0)
    }
}

/// Hotbar textures shipped as resource packs (ItemsAdder / Nexo / Oraxen / HappyHUD `pack/` folders)
fn find_widgets(vfs: &Vfs, imgs: &mut ImageTable) -> Vec<J> {
    let mut out = vec![];
    // the same hotbar is often shipped for ItemsAdder, Nexo and Oraxen: list it once
    let mut seen: BTreeSet<Vec<u8>> = BTreeSet::new();
    for k in vfs.files.keys() {
        let l = k.to_ascii_lowercase();
        let is_legacy = l == "minecraft/textures/gui/widgets.png" || l.ends_with("/minecraft/textures/gui/widgets.png");
        let is_modern = l == "minecraft/textures/gui/sprites/hud/hotbar.png" || l.ends_with("/minecraft/textures/gui/sprites/hud/hotbar.png");
        if !is_legacy && !is_modern {
            continue;
        }
        let Some(bar_bytes) = vfs.get(k) else { continue };
        // skip blank/dummy hotbar.png files that packs include to hide the vanilla hotbar
        if !has_visible_hotbar(bar_bytes, is_legacy) {
            continue;
        }
        let mut key = bar_bytes.clone();
        if is_modern {
            let sel = format!("{}hotbar_selection.png", &k[..k.len() - "hotbar.png".len()]);
            key.extend(vfs.get(&sel).cloned().unwrap_or_default());
        }
        if !seen.insert(key) {
            continue;
        }
        if is_legacy {
            if let Some((id, w, h)) = imgs.add(vfs, k) {
                out.push(json!({ "format": "legacy", "path": k, "widgets": id, "size": [w, h] }));
            }
        } else {
            let sel = format!("{}hotbar_selection.png", &k[..k.len() - "hotbar.png".len()]);
            if let (Some((bar, _, _)), Some((s, _, _))) = (imgs.add(vfs, k), imgs.add(vfs, &sel)) {
                out.push(json!({ "format": "modern", "path": k, "hotbar": bar, "selection": s }));
            }
        }
    }
    out
}

/// Unchecks a single-image 180×20 / 182×22 opaque hotbar HUD when the pack also ships a Widgets
/// hotbar texture: on Bedrock, a HUD image draws above hotbar item icons, whereas Widgets draws under them.
fn demote_duplicate_hotbar_hud(vfs: &Vfs, images: &[J], variants: &mut [J]) {
    for v in variants {
        let Some(huds) = v["huds"].as_array_mut() else { continue };
        for h in huds {
            if h["default"] != J::Bool(true) {
                continue;
            }
            let Some(els) = h["elements"].as_array() else { continue };
            if els.len() != 1 {
                continue;
            }
            let e = &els[0];
            if e["kind"] != "image" || e["anchor"] != "bottom_middle" {
                continue;
            }
            let (Some(w), Some(hh), Some(oy)) = (e["size"][0].as_f64(), e["size"][1].as_f64(), e["offset"][1].as_f64()) else { continue };
            if !(178.0..=186.0).contains(&w) || !(18.0..=24.0).contains(&hh) || !(-6.0..=0.0).contains(&oy) {
                continue;
            }
            let Some(id) = e["image"].as_u64().map(|x| x as usize) else { continue };
            let Some(path) = images.get(id).and_then(|im| im["path"].as_str()) else { continue };
            let Some(bytes) = vfs.get(path) else { continue };
            let Ok(im) = image::load_from_memory(bytes) else { continue };
            let rgba = im.to_rgba8();
            let (iw, ih) = rgba.dimensions();
            if iw >= 20 && ih >= 10 && rgba.get_pixel(10, ih / 2)[3] >= 40 {
                h["default"] = J::Bool(false);
                if let Some(notes) = h["notes"].as_array_mut() {
                    notes.push(J::from("Unchecked by default: the pack's hotbar texture (below) already draws this hotbar behind your items — importing this HUD image too would draw on top of hotbar items in Bedrock"));
                }
            }
        }
    }
}

/* ───────────────────────── entry point ───────────────────────── */

fn variant_name(root: &str, plugin: Plugin) -> String {
    let trimmed = root.trim_end_matches('/');
    if trimmed.is_empty() {
        plugin.label().to_string()
    } else {
        format!("{} — {}", plugin.label(), trimmed)
    }
}

/// Reads a pack (zip file or folder) and returns everything that can be imported.
pub fn import_pack(path: &Path) -> Result<J, String> {
    let vfs = Vfs::load(path)?;
    let mut imgs = ImageTable::new();
    let found = detect_roots(&vfs);
    let mut roots: Vec<(String, Plugin, Option<String>)> = found.iter().map(|(r, p)| (r.clone(), *p, None)).collect();
    for (base, o) in detect_overlays(&vfs, &found) {
        roots.push((base, Plugin::BetterHud, Some(o)));
    }
    let mut variants = vec![];
    for (root, plugin, overlay) in &roots {
        let (mut huds, mut warnings, info) = match plugin {
            Plugin::BetterHud => parse_betterhud(&vfs, root, overlay.as_deref(), &mut imgs),
            Plugin::HappyHud => parse_happy_mythic(&vfs, root, true, &mut imgs),
            Plugin::MythicHud => parse_happy_mythic(&vfs, root, false, &mut imgs),
            Plugin::Nameplates => parse_nameplates(&vfs, root, &mut imgs),
        };
        if let Some((dy, name)) = hotbar_hole_shift(&vfs, &imgs.list, &huds) {
            shift_bottom(&mut huds, dy);
            warnings.push(format!("Lined up the hotbar frame '{}' with the hotbar: bottom items moved up {} px", name, -dy));
        } else {
            shift_bottom(&mut huds, HOTBAR_LIFT);
        }
        hotbar_overlaps(&mut huds);
        clear_top_buttons(&mut huds);
        variants.push(json!({
            "id": match overlay { Some(o) => format!("{}:{}+{}", plugin.id(), root, o), None => format!("{}:{}", plugin.id(), root) },
            "name": match overlay { Some(o) => format!("{} (+ {})", variant_name(o, *plugin), root.trim_end_matches('/')), None => variant_name(root, *plugin) },
            "plugin": plugin.id(),
            "root": root,
            "huds": huds.iter().map(|h| h.to_json()).collect::<Vec<_>>(),
            "warnings": warnings,
            "info": info,
        }));
    }
    let widgets = find_widgets(&vfs, &mut imgs);
    if !widgets.is_empty() {
        demote_duplicate_hotbar_hud(&vfs, &imgs.list, &mut variants);
    }
    if variants.is_empty() && widgets.is_empty() {
        return Err("No BetterHud, HappyHUD, MythicHUD or CustomNameplates boss bar configuration was found in this pack".into());
    }
    let source = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(json!({
        "source": source,
        "screen": [REF_W, REF_H],
        "variants": variants,
        "widgets": widgets,
        "images": imgs.list,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn visibility_conditions() {
        let none = |_: &str| None;
        let ls = IndexMap::new();
        let vis = |c: &str| match convert_cond(c, &none, &ls) {
            CondResult::Visible(v) => Some((v.papi, v.op, v.value)),
            _ => None,
        };
        // party HUD slot 1: shown unless the party count is 1
        assert_eq!(vis("placeholder{ph=%mmocore_party_count%;v=1;o==} false hide"), Some(("%mmocore_party_count%".into(), "!=".into(), "1".into())));
        assert_eq!(vis("placeholder{ph=%parseother_unsafe_{a}_{b}%;v=0;o=>} true hide"), Some(("%parseother_unsafe_{a}_{b}%".into(), ">".into(), "0".into())));
        assert!(vis("placeholder{ph=%x%;v=1} true color #ff0000").is_none());
        // HappyHUD `show` action + comma-separated gamemode list
        assert_eq!(vis("effect{e=poison} true show"), Some(("%player_has_potioneffect_POISON%".into(), "==".into(), "yes".into())));
        assert_eq!(vis("gamemode{gm=survival} true hide"), Some(("%player_gamemode%".into(), "==".into(), "SURVIVAL".into())));
        match convert_cond("gamemode{gm=creative,spectator} false hide", &none, &ls) {
            CondResult::Many(vs) => assert_eq!(
                vs,
                vec![
                    Cond { papi: "%player_gamemode%".into(), op: "!=".into(), value: "CREATIVE".into() },
                    Cond { papi: "%player_gamemode%".into(), op: "!=".into(), value: "SPECTATOR".into() },
                ]
            ),
            _ => panic!("expected CondResult::Many"),
        }
        // Blossom air: shown while air < 100% (300 ticks)
        let air = |l: &str| if l == "fill" { Some("air".to_string()) } else { None };
        match convert_cond("progress{l=fill;o=<;v=100%} true hide", &air, &ls) {
            CondResult::Visible(v) => assert_eq!((v.papi.as_str(), v.op.as_str(), v.value.as_str()), ("%player_remaining_air%", "<", "300")),
            _ => panic!("expected CondResult::Visible"),
        }
        let armor = |l: &str| if l == "fill" { Some("armor".to_string()) } else { None };
        assert!(matches!(convert_cond("progress{l=fill;o=>;v=0} true hide", &armor, &ls), CondResult::Note(_)));
    }

    #[test]
    fn duplicate_keys_last_wins() {
        let text = "lay:\n  images:\n    1:\n      name: a\n      x: 1\n    1:\n      name: b\n    2:\n      name: c\nother:\n  - x: 1\n  - x: 1\n";
        let (y, dup) = parse_yaml_noted(text.as_bytes()).unwrap();
        assert!(dup);
        let imgs = get(get(&y, "lay").unwrap(), "images").unwrap();
        assert_eq!(entries(Some(imgs)).len(), 2);
        assert_eq!(st(get(get(imgs, "1").unwrap(), "name")).as_deref(), Some("b"));
        assert!(get(get(imgs, "1").unwrap(), "x").is_none());
        // the same key in different list items is not a duplicate
        assert_eq!(entries(get(&y, "other")).len(), 2);
        let (_, dup) = parse_yaml_noted(b"a: 1\nb: 2\n").unwrap();
        assert!(!dup);
    }

    #[test]
    fn effect_and_betterhud_conditions() {
        let none = |_: &str| None;
        let ls = IndexMap::new();
        match convert_cond("effect{e=poison} true hide", &none, &ls) {
            CondResult::Visible(v) => assert_eq!((v.papi.as_str(), v.op.as_str(), v.value.as_str()), ("%player_has_potioneffect_POISON%", "==", "yes")),
            _ => panic!("expected CondResult::Visible"),
        }
        // old Bukkit names → current keys (Paper 26 throws on the old ones)
        match convert_cond("effect{e=damage_resistance} true hide", &none, &ls) {
            CondResult::Visible(v) => assert_eq!(v.papi, "%player_has_potioneffect_RESISTANCE%"),
            _ => panic!("expected CondResult::Visible"),
        }
        assert_eq!(modern_effect_name("minecraft:slow_digging"), "MINING_FATIGUE");
        assert_eq!(modern_effect_name("luck"), "LUCK");
        // BetterHud `(number)` cast inside quotes on `second` and built-in `health` on `first` (PrimeHUD v2)
        let y: Y = serde_yaml::from_str("1: {first: '(number)health', second: \"'(number)10'\", operation: '<='}\n2: {first: '(number)papi:player_ping', second: \"'(number)120'\", operation: '>'}").unwrap();
        let (c, notes) = convert_betterhud_conditions(Some(&y));
        assert_eq!(
            c,
            vec![
                Cond { papi: "%player_health_rounded%".into(), op: "<=".into(), value: "10".into() },
                Cond { papi: "%player_ping%".into(), op: ">".into(), value: "120".into() },
            ]
        );
        assert!(notes.is_empty());
        // `dead == false` is skipped quietly, the useful condition is kept
        let y: Y = serde_yaml::from_str("1: {first: dead, second: false, operation: '=='}\n2: {first: 'papi:player_remaining_air', second: \"'300'\", operation: '!='}").unwrap();
        let (c, notes) = convert_betterhud_conditions(Some(&y));
        assert_eq!(c.len(), 1);
        assert_eq!((c[0].papi.as_str(), c[0].op.as_str(), c[0].value.as_str()), ("%player_remaining_air%", "!=", "300"));
        assert!(notes.is_empty());
        // several conditions are all kept (all must hold); repeats are dropped
        let y: Y = serde_yaml::from_str("1: {first: 'papi:armor_has_helmet', second: \"'true'\", operation: '=='}\n2: {first: 'papi:armor_material_helmet', second: \"'DIAMOND_HELMET'\", operation: '!='}\n3: {first: 'papi:armor_has_helmet', second: \"'true'\", operation: '=='}").unwrap();
        let (c, notes) = convert_betterhud_conditions(Some(&y));
        assert_eq!(c.len(), 3);
        assert!(notes.is_empty());
        let (first, extra) = vis_fields(c.iter());
        assert_eq!(first["papi"], "%armor_has_helmet%");
        assert_eq!(extra, json!([{ "papi": "%armor_material_helmet%", "op": "!=", "value": "DIAMOND_HELMET" }]));
    }

    #[test]
    fn sequence_becomes_animation() {
        let png = |c: u8| {
            let img = image::RgbaImage::from_pixel(5, 3, image::Rgba([c, 0, 0, 255]));
            let mut buf = Vec::new();
            image::DynamicImage::ImageRgba8(img).write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png).unwrap();
            buf
        };
        let mut vfs = Vfs::new();
        // a, a, a, a, b, b, b, b (each file its own copy, like HudGraveyard)
        for i in 1..=8u8 {
            vfs.insert(format!("BetterHud/assets/f/f{}.png", i), png(if i <= 4 { 1 } else { 2 })).unwrap();
        }
        vfs.index();
        let mut imgs = ImageTable::new();
        let frames: Vec<(String, u32)> = (1..=8).map(|i| (format!("f/f{}.png", i), 1)).collect();
        let mut notes = vec![];
        let a = build_anim(&vfs, &mut imgs, &["BetterHud/assets/".to_string()], &frames, 50.0, &mut notes).unwrap();
        assert_eq!(a["frames"].as_array().unwrap().len(), 2);
        assert_eq!(a["fps"], 5.0);
        // uneven timings: 4 + 2 ticks → 3 frames at 10 fps
        let frames = vec![("f/f1.png".to_string(), 4), ("f/f5.png".to_string(), 2)];
        let a = build_anim(&vfs, &mut imgs, &["BetterHud/assets/".to_string()], &frames, 50.0, &mut notes).unwrap();
        assert_eq!(a["frames"].as_array().unwrap().len(), 3);
        assert_eq!(a["fps"], 10.0);
        // one picture only: still image
        let frames = vec![("f/f1.png".to_string(), 1), ("f/f2.png".to_string(), 1)];
        assert!(build_anim(&vfs, &mut imgs, &["BetterHud/assets/".to_string()], &frames, 50.0, &mut notes).is_none());
        assert!(notes.is_empty());
    }

    #[test]
    fn pattern_slash_escape() {
        let p = parse_pattern("[papi:auraskills_mana_int]//[papi:auraskills_mana_max_int]", true);
        assert_eq!(p.papi, "%auraskills_mana_int%/%auraskills_mana_max_int%");
        let p = parse_pattern("HP /[[papi:a]/]", true);
        assert_eq!(p.papi, "HP [%a%]");
    }

    #[test]
    fn patterns() {
        let p = parse_pattern("<image:dinar> [papi:hardcurrency_dinar]", true);
        assert_eq!(p.papi, "%hardcurrency_dinar%");
        assert_eq!(p.leading_icons, vec!["dinar"]);
        let p = parse_pattern("&a[papi:player_ping]ms", true);
        assert_eq!(p.papi, "%player_ping%ms");
        assert_eq!(p.color.as_deref(), Some("#55FF55"));
        let p = parse_pattern("<#61ff6c>[level]", true);
        assert_eq!(p.papi, "%player_level%");
        assert_eq!(p.color.as_deref(), Some("#61ff6c"));
        let p = parse_pattern("MP.[(number)papi:mmocore_mana]|[(number)papi:mmocore_stat_max_mana]", true);
        assert_eq!(p.papi, "MP.%mmocore_mana%|%mmocore_stat_max_mana%");
        let p = parse_pattern("<white>X:%player_x% Y:%player_y%", false);
        assert_eq!(p.papi, "X:%player_x% Y:%player_y%");
        assert_eq!(p.color.as_deref(), Some("#FFFFFF"));
    }

    #[test]
    fn anchors() {
        let mut n = vec![];
        let sp = screen_point(50.0, 100.0, &mut n);
        assert_eq!(sp.anchor, "bottom_middle");
        // element 10×6 whose top-left is 36px above the bottom centre, 58px left
        let (_, off, _) = place(&sp, -58.0, -36.0, 10.0, 6.0);
        assert_eq!(off, [-53.0, -30.0]);
        assert!(n.is_empty());
        let sp = screen_point(0.0, 0.0, &mut n);
        assert_eq!(sp.anchor, "top_left");
        let sp = screen_point(100.0, 50.0, &mut n);
        assert_eq!(sp.anchor, "middle_right");
    }

    #[test]
    fn nameplates_and_merged_colour_texts() {
        let png = |w: u32, h: u32| {
            let img = image::RgbaImage::from_pixel(w, h, image::Rgba([255, 255, 255, 255]));
            let mut buf = Vec::new();
            image::DynamicImage::ImageRgba8(img).write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png).unwrap();
            buf
        };
        // 1. CustomNameplates boss bar with ConditionalTextPlaceholders + custom font ascent + right shift
        let mut vfs = Vfs::new();
        vfs.insert("CustomNameplates/configs/bossbar.yml".into(), b"hud:\n  dynamic-text:\n    - '%img_offset_440%%img_box%%conditionaltext_s% %img_offset_-68%<font:np:lower><black>%customcrops_season%</font>'\n".to_vec()).unwrap();
        vfs.insert("ConditionalTextPlaceholders/settings.yml".into(), b"s:\n  placeholder: '%customcrops_season%'\n  rules:\n    - '=Spring;%img_offset_-132%%img_spring%'\n    - '=Winter;%img_offset_-132%%img_winter%'\n".to_vec()).unwrap();
        vfs.insert("ItemsAdder/contents/rp/configs/font.yml".into(), b"info:\n  namespace: np\nfont_images:\n  box: { path: 'np:font/box', scale_ratio: 92, y_position: 8 }\n  spring: { path: 'np:font/spring', scale_ratio: 92, y_position: 8 }\n  winter: { path: 'np:font/winter', scale_ratio: 92, y_position: 8 }\n".to_vec()).unwrap();
        vfs.insert("ItemsAdder/contents/rp/resourcepack/assets/np/font/lower.json".into(), br#"{"providers":[{"type":"bitmap","ascent":-35,"height":8}]}"#.to_vec()).unwrap();
        for n in ["box", "spring", "winter"] {
            vfs.insert(format!("ItemsAdder/contents/rp/resourcepack/assets/np/textures/font/{}.png", n), png(86, 60)).unwrap();
        }
        vfs.index();
        assert_eq!(detect_roots(&vfs), vec![("".to_string(), Plugin::Nameplates)]);
        let mut imgs = ImageTable::new();
        let (huds, warns, _) = parse_nameplates(&vfs, "", &mut imgs);
        assert!(warns.is_empty());
        assert_eq!(huds.len(), 1);
        let els = &huds[0].elements;
        assert_eq!(els.len(), 4); // box + spring + winter + season text
        assert_eq!(els[0]["anchor"], "top_right");
        assert_eq!(els[0]["offset"], els[1]["offset"]); // spring aligns 0px on box
        assert_eq!(els[1]["visibility"]["value"], "Spring");
        assert_eq!(els[2]["visibility"]["value"], "Winter");
        assert_eq!(els[3]["offset"][1], 45.0); // BASELINE (10) - ascent (-35) = 45

        // 2. BetterHud repeated conditional colour texts keep 1 text while keeping all conditional icons
        let mut vfs2 = Vfs::new();
        vfs2.insert("huds/ping.yml".into(), b"ping:\n  layouts:\n    1: { name: ping, x: 0, y: 0 }\n".to_vec()).unwrap();
        vfs2.insert("images/d.yml".into(), b"dummy: { type: single, file: g.png }\n".to_vec()).unwrap();
        vfs2.insert("texts/f.yml".into(), b"f:\n  scale: 8\n  images:\n    g: { name: g.png }\n    r: { name: r.png }\n".to_vec()).unwrap();
        vfs2.insert("layouts/ping.yml".into(), b"ping:\n  texts:\n    1:\n      name: f\n      pattern: '<image:g> <green>[papi:player_ping]'\n      x: 10\n      y: 20\n      conditions:\n        1: { first: '(number)papi:player_ping', second: \"'(number)120'\", operation: '<=' }\n    2:\n      name: f\n      pattern: '<image:r> <red>[papi:player_ping]'\n      x: 10\n      y: 20\n      conditions:\n        1: { first: '(number)papi:player_ping', second: \"'(number)120'\", operation: '>' }\n".to_vec()).unwrap();
        vfs2.insert("assets/g.png".into(), png(8, 8)).unwrap();
        vfs2.insert("assets/r.png".into(), png(8, 8)).unwrap();
        vfs2.index();
        let mut imgs2 = ImageTable::new();
        let (huds2, _, _) = parse_betterhud(&vfs2, "", None, &mut imgs2);
        let els2 = &huds2[0].elements;
        assert_eq!(els2.iter().filter(|e| e["kind"] == "text").count(), 1);
        assert_eq!(els2.iter().filter(|e| e["kind"] == "image").count(), 2);
        assert_eq!(els2[0]["visibility"]["value"], "120");
        assert_eq!(els2[2]["visibility"]["op"], ">");
    }

    /// Runs the importer over every pack in KZ_HUD_PACKS (folders and zips)
    #[test]
    fn real_packs() {
        let Ok(dir) = std::env::var("KZ_HUD_PACKS") else { return };
        let out_dir = std::env::var("KZ_OUT").ok();
        for entry in std::fs::read_dir(&dir).unwrap().flatten() {
            let p = entry.path();
            let res = import_pack(&p).unwrap_or_else(|e| panic!("{}: {}", p.display(), e));
            let variants = res["variants"].as_array().unwrap();
            assert!(!variants.is_empty(), "{}: nothing detected", p.display());
            for v in variants {
                let huds = v["huds"].as_array().unwrap();
                let n: usize = huds.iter().map(|h| h["elements"].as_array().unwrap().len()).sum();
                eprintln!("{} | {} | {} huds, {} elements, {} warnings", p.display(), v["name"], huds.len(), n, v["warnings"].as_array().unwrap().len());
                assert!(n > 0, "{}: {} has no elements", p.display(), v["name"]);
            }
            eprintln!("  widgets: {}", res["widgets"].as_array().unwrap().len());
            if let Ok(full) = std::env::var("KZ_OUT_FULL") {
                let name = p.file_name().unwrap().to_string_lossy().replace(' ', "_");
                std::fs::write(format!("{}/{}.full.json", full, name), serde_json::to_string(&res).unwrap()).unwrap();
            }
            if let Some(o) = &out_dir {
                let mut slim = res.clone();
                slim["images"] = J::from(res["images"].as_array().unwrap().iter().map(|i| json!({"id": i["id"], "path": i["path"], "w": i["width"], "h": i["height"]})).collect::<Vec<_>>());
                let name = p.file_name().unwrap().to_string_lossy().replace(' ', "_");
                std::fs::write(format!("{}/{}.json", o, name), serde_json::to_string_pretty(&slim).unwrap()).unwrap();
            }
        }
    }
}
