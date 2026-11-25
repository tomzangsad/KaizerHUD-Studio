//! Port of `server_codegen.js`: builds the Bedrock JSON UI files and the
//! KaizerMultiBar `config.yml` from the editor's elements.

use crate::js::*;
use indexmap::IndexMap;
use serde_json::{json, Value};
use std::collections::HashSet;

const LETTERS: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
const NEWBOS_PREFIX: &str = "@zelisce/custom_bossbars";

/// Expression that removes "prefix:" from the boss bar title before it is sliced by byte.
/// Geyser prepends a reset code to boss bar titles (MessageTranslator.convertMessage), so
/// "§r" + prefix is stripped first, then the bare prefix as a fallback for other clients.
fn strip_bossbar_prefix() -> String {
    format!("((#bossName - '\u{a7}r{p}:') - '{p}:')", p = NEWBOS_PREFIX)
}

/// Default text_offset per text row and font size. Copied from ui/js/app.js DEFAULT_TEXT_OFFSETS
/// (top row) and the per-row defaults in ui/js/controls.js / javaexport.js TEXT_DEFAULT_OFFSET.
fn default_text_offset(row_middle: bool, font_size: &str) -> [f64; 2] {
    match (row_middle, font_size) {
        (false, "normal") => [0.0, -4.1],
        (false, "large") => [0.0, -5.3],
        (false, _) => [0.0, -2.8],
        (true, "normal") => [0.0, 1.4],
        (true, "large") => [0.0, 2.0],
        (true, _) => [0.0, 0.9],
    }
}

/// Bedrock draws a centred small label's glyphs about 1 px low (measured in game 2026-11-22);
/// centred normal text and the XP number are already centred (calibration project 2026-11-22),
/// large is not measured (0). Middle-row labels are lifted by this much.
fn bedrock_middle_label_lift(font_size: &str) -> f64 {
    match font_size {
        "normal" | "large" => 0.0,
        _ => -1.0,
    }
}

/// Label offset inside a slot's 1x1 panel: the element's text_offset minus the default for its
/// row and font size (the same rule as the Java export), so a default offset gives [0, 0];
/// middle-row labels also get the Bedrock font correction, so their glyphs are centred.
/// row = middle when the text anchor sits at half height, otherwise top (top_* and bottom_*).
fn text_offset_delta(slot: &Value, font_size: &str, text_anchor_from: &str) -> Value {
    let row_middle = matches!(text_anchor_from, "center" | "left_middle" | "right_middle" | "middle_left" | "middle_right");
    let to = get(slot, "text_offset")
        .filter(|v| v.is_array())
        .or_else(|| get(slot, "text_offsets").and_then(|o| get(o, font_size)).filter(|v| v.is_array()));
    let def = default_text_offset(row_middle, font_size);
    let lift = if row_middle { bedrock_middle_label_lift(font_size) } else { 0.0 };
    let delta = |i: usize| {
        let v = to_number(to.and_then(|t| t.as_array()).and_then(|a| a.get(i)));
        let d = if to.is_some() && v.is_finite() { v - def[i] } else { 0.0 };
        let d = if i == 1 { d + lift } else { d };
        (d * 10.0).round() / 10.0 + 0.0
    };
    json!([num(delta(0)), num(delta(1))])
}

fn el_type(e: &Value) -> &str {
    get(e, "type").and_then(|v| v.as_str()).unwrap_or("")
}

fn of_type<'a>(elements: &'a [Value], t: &str) -> Vec<&'a Value> {
    elements.iter().filter(|e| el_type(e) == t).collect()
}

fn sanitize_name(name: Option<&Value>) -> String {
    if !truthy(name) {
        return "unnamed".into();
    }
    let lower = js_string(name).to_lowercase();
    let mut out = String::new();
    for c in lower.chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            out.push(c);
        } else {
            // JS regex works on UTF-16 code units
            for _ in 0..c.len_utf16() {
                out.push('_');
            }
        }
    }
    out
}

fn by_collection_index<'a>(elements: &'a [Value], t: &str) -> Vec<&'a Value> {
    let mut v = of_type(elements, t);
    js_sort_by(&mut v, |a, b| {
        to_number(get(a, "collection_index")) - to_number(get(b, "collection_index"))
    });
    v
}

fn get_bossbar_slots(elements: &[Value]) -> Vec<&Value> {
    by_collection_index(elements, "text")
}

fn get_nameplate_slots(elements: &[Value]) -> Vec<&Value> {
    by_collection_index(elements, "nameplate")
}

pub fn get_bar_default_prefix(bar: &Value, elements: &[Value]) -> String {
    if str_eq(get(bar, "barType"), "custom") {
        if truthy(get(bar, "barCustomTag")) {
            return js_string(get(bar, "barCustomTag"));
        }
        let custom: Vec<&Value> = elements
            .iter()
            .filter(|e| el_type(e) == "bar" && str_eq(get(e, "barType"), "custom"))
            .collect();
        let idx = custom.iter().position(|e| std::ptr::eq(*e, bar));
        let i = match idx {
            Some(i) if i < 26 => i,
            _ => 0,
        };
        return format!("c{}", LETTERS[i] as char);
    }
    let tag = match js_string(get(bar, "barType")).as_str() {
        "hp" => "kh",
        "hp_freezing" => "fz",
        "hp_absorption" => "ab",
        "hp_health_boost" => "hb",
        "hp_regeneration" => "kr",
        "hp_wither" => "kw",
        "hp_poison" => "kp",
        "food" => "kf",
        "food_hunger" => "kg",
        "food_saturation" => "ks",
        "armor" => "ka",
        "air" => "ko",
        "exp" => "ex",
        _ => "h",
    };
    tag.into()
}

/// Pad length (bytes in the bossbar title) of a text / nameplate slot: automatic from its
/// placeholders unless the element has `pad_auto: false`, then its own `pad_length` (default 30).
fn get_bossbar_slot_raw_length(slot: &Value) -> Value {
    if matches!(get(slot, "pad_auto"), Some(Value::Bool(false))) {
        return or(get(slot, "pad_length"), json!(30));
    }
    json!(auto_pad_length(&str_or_empty(get(slot, "papi_placeholder"))))
}

/// Longest value (UTF-8 bytes) a PlaceholderAPI placeholder is expected to print.
/// Short stats (health, food, armor, air, level, mana) are 2–5 digits; names, money, time and
/// coordinates are longer; unknown placeholders get 16. Mirrored in ui/js/app.js PLACEHOLDER_MAX_BYTES.
pub fn placeholder_max_bytes(name: &str) -> usize {
    let n = name.trim().to_ascii_lowercase();
    if let Some(fmt) = n.strip_prefix("server_time_") {
        return fmt.len().max(1); // each pattern letter prints one char (HH:mm → 14:30)
    }
    match n.as_str() {
        // health: up to 1024 (max_health attribute), *_rounded are integers
        "player_health_rounded" | "player_max_health_rounded" => 4,
        "player_health" | "player_max_health" => 6, // "1024.0"; prefer the _rounded forms
        "player_food_level" | "player_armor" | "player_armor_toughness" => 2,
        "player_saturation" | "player_exhaustion" => 5,
        "player_remaining_air" | "player_max_air" => 3, // -20 … 300
        "player_level" | "player_exp_to_level" => 5,
        "player_exp" | "player_total_exp" => 7,
        "auraskills_mana_int" | "auraskills_mana_max_int" => 5,
        "auraskills_mana" | "auraskills_mana_max" => 8,
        "player_ping" | "server_online" | "server_max_players" => 4,
        "server_tps" => 5,
        "player_x" | "player_y" | "player_z" => 9, // -30000000
        "player_name" => 17, // 16 + Geyser/Floodgate prefix "."
        "vault_eco_balance_formatted" => 8, // "999.99K"
        "vault_eco_balance_fixed" => 15,
        "vault_eco_balance" | "vault_eco_balance_commas" => 18,
        "player_world" | "player_gamemode" => 16,
        "player_biome" => 24,
        _ => 16,
    }
}

/// Automatic pad length of a slot text: the "§z" marker the config adds (3 bytes, ASCII texts
/// only) + the literal text in UTF-8 bytes ("&x" colour codes become "§x" = 3 bytes) + the
/// longest value of every %placeholder%. The plugin pads / cuts to exactly this many bytes.
pub fn auto_pad_length(papi: &str) -> usize {
    let mut total = if has_non_ascii(papi) { 0 } else { 3 };
    let chars: Vec<char> = papi.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '%' {
            if let Some(end) = chars[i + 1..].iter().position(|&x| x == '%') {
                let name: String = chars[i + 1..i + 1 + end].iter().collect();
                if !name.is_empty() && !name.contains(' ') {
                    total += placeholder_max_bytes(&name);
                    i += end + 2;
                    continue;
                }
            }
        }
        if c == '&' && i + 1 < chars.len() {
            let n = chars[i + 1].to_ascii_lowercase();
            if n.is_ascii_hexdigit() || ('k'..='o').contains(&n) || matches!(n, 'r' | 'x' | 'z' | 'y' | 'w' | 'v') {
                total += 3;
                i += 2;
                continue;
            }
        }
        total += c.len_utf8();
        i += 1;
    }
    total.max(1)
}

/// Pad of the 5 default bars in config.yml (`@1kh16` = 6).
const DEFAULT_BAR_PAD: usize = 6;
const DEFAULT_BAR_COUNT: usize = 5;

/// Pad of custom bar number `slot_number` with tag `tag`: `@{n}{tag}16`.
fn custom_bar_pad(slot_number: usize, tag: &str) -> usize {
    format!("@{}{}", slot_number, tag).len() + 2
}

/// Length of the bars section of the title (`bossbar.bars-length` in config.yml): the sum of
/// every bar's pad, so no space is wasted before the slots.
pub fn bars_section_length(elements: &[Value]) -> usize {
    let custom: usize = get_custom_bar_config_entries(elements)
        .iter()
        .enumerate()
        .map(|(i, e)| custom_bar_pad(i + 6, &e.tag))
        .sum();
    DEFAULT_BAR_COUNT * DEFAULT_BAR_PAD + custom
}

/// Total title length: prefix + bars section + every slot and nameplate pad
/// (visibility-condition markers at the end are not counted). The app's warning
/// (`bossbarTitleBudget` in ui/js/export.js, limit 255) computes the same number.
#[allow(dead_code)]
pub fn bossbar_title_length(elements: &[Value]) -> usize {
    let pads: usize = get_bossbar_slots(elements)
        .iter()
        .map(|s| get_bossbar_slot_raw_length(s))
        .chain(get_nameplate_slots(elements).iter().map(|n| get_bossbar_slot_raw_length(n)))
        .map(|v| to_number(Some(&v)).max(0.0) as usize)
        .sum();
    NEWBOS_PREFIX.len() + 1 + bars_section_length(elements) + pads
}

fn sanitize_custom_bar_key(value: &str, fallback: &str) -> String {
    let lower = value.trim().to_lowercase();
    let mut out = String::new();
    let mut in_run = false;
    for c in lower.chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' {
            out.push(c);
            in_run = false;
        } else if !in_run {
            out.push('_');
            in_run = true;
        }
    }
    let trimmed = out.trim_matches('_').to_string();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed
    }
}

struct CustomBarEntry {
    key: String,
    tag: String,
    papi: String,
    max: String,
}

fn str_or_empty(v: Option<&Value>) -> String {
    // String(x || "")
    if truthy(v) {
        js_string(v)
    } else {
        String::new()
    }
}

fn get_custom_bar_config_entries(elements: &[Value]) -> Vec<CustomBarEntry> {
    let mut used_keys: HashSet<String> = HashSet::new();
    let mut used_tags: HashSet<String> = HashSet::new();
    let mut out = vec![];
    for bar in elements
        .iter()
        .filter(|e| el_type(e) == "bar" && str_eq(get(e, "barType"), "custom"))
    {
        let raw_tag = str_or_empty(get(bar, "barCustomTag")).trim().to_string();
        let mut safe_tag = raw_tag;
        if safe_tag.is_empty() {
            for l in LETTERS {
                let candidate = format!("c{}", *l as char);
                if !used_tags.contains(&candidate) {
                    safe_tag = candidate;
                    break;
                }
            }
            if safe_tag.is_empty() {
                safe_tag = "cx".into();
            }
        }
        used_tags.insert(safe_tag.to_lowercase());
        let name_or_tag = if truthy(get(bar, "name")) {
            js_string(get(bar, "name"))
        } else {
            safe_tag.clone()
        };
        let mut key = sanitize_custom_bar_key(&name_or_tag, &safe_tag);
        let mut suffix = 2;
        while used_keys.contains(&key) {
            key = format!("{}_{}", sanitize_custom_bar_key(&name_or_tag, &safe_tag), suffix);
            suffix += 1;
        }
        used_keys.insert(key.clone());
        out.push(CustomBarEntry {
            key,
            tag: safe_tag,
            papi: str_or_empty(get(bar, "barCustomPapi")).trim().to_string(),
            max: str_or_empty(get(bar, "barCustomMax")).trim().to_string(),
        });
    }
    out
}

struct PrefixCfg {
    enabled: bool,
    prefix: String,
}

fn pc(prefix: &str) -> PrefixCfg {
    PrefixCfg { enabled: false, prefix: prefix.into() }
}

struct StatusPrefix {
    health_default: String,
    health_special: IndexMap<&'static str, PrefixCfg>,
    health_effects: IndexMap<&'static str, PrefixCfg>,
    food_default: String,
    food_effects: IndexMap<&'static str, PrefixCfg>,
}

fn get_configured_status_prefix_map(elements: &[Value]) -> StatusPrefix {
    let mut r = StatusPrefix {
        health_default: "kh".into(),
        health_special: IndexMap::from([("FREEZING", pc("fz"))]),
        health_effects: IndexMap::from([
            ("ABSORPTION", pc("ab")),
            ("HEALTH_BOOST", pc("hb")),
            ("REGENERATION", pc("kr")),
            ("WITHER", pc("kw")),
            ("POISON", pc("kp")),
        ]),
        food_default: "kf".into(),
        food_effects: IndexMap::from([("HUNGER", pc("kg")), ("SATURATION", pc("ks"))]),
    };
    for bar in elements.iter().filter(|e| el_type(e) == "bar") {
        let pfx = get_bar_default_prefix(bar, elements);
        let p = |d: &str| -> String {
            if pfx.is_empty() {
                d.to_string()
            } else {
                pfx.clone()
            }
        };
        let on = |d: &str| PrefixCfg { enabled: true, prefix: p(d) };
        let bt = get(bar, "barType");
        if str_eq(bt, "hp") {
            r.health_default = p("kh");
        } else if str_eq(bt, "food") {
            r.food_default = p("kf");
        } else if str_eq(bt, "hp_freezing") {
            r.health_special.insert("FREEZING", on("fz"));
        } else if str_eq(bt, "hp_absorption") {
            r.health_effects.insert("ABSORPTION", on("ab"));
        } else if str_eq(bt, "hp_health_boost") {
            r.health_effects.insert("HEALTH_BOOST", on("hb"));
        } else if str_eq(bt, "hp_regeneration") {
            r.health_effects.insert("REGENERATION", on("kr"));
        } else if str_eq(bt, "hp_wither") {
            r.health_effects.insert("WITHER", on("kw"));
        } else if str_eq(bt, "hp_poison") {
            r.health_effects.insert("POISON", on("kp"));
        } else if str_eq(bt, "food_hunger") {
            r.food_effects.insert("HUNGER", on("kg"));
        } else if str_eq(bt, "food_saturation") {
            r.food_effects.insert("SATURATION", on("ks"));
        }
    }
    r
}

struct VisibilityCfg {
    prefix: String,
    papi: String,
    operator: String,
    value: String,
    invert: bool,
}

/// One condition of an element (prefix left empty; see `visibility_keys`)
fn vis_cfg(papi: &str, operator: &str, value: &str, invert: bool) -> VisibilityCfg {
    VisibilityCfg {
        prefix: String::new(),
        papi: papi.trim().to_string(),
        operator: operator.to_string(),
        value: value.trim().to_string(),
        invert,
    }
}

/// The element's conditions, all of which must be true: the main one (`visibilityPapi` …)
/// and the extra ones (`visibilityExtra: [{ papi, op, value, invert }]`, the "+" button and
/// the Java importer). Texts and nameplates can't be hidden (empty list).
fn raw_visibility_conditions(el: &Value) -> Vec<VisibilityCfg> {
    let t = el_type(el);
    let is_bar = t == "bar";
    let is_other = t == "image" || t == "player_head" || t == "xp_label";
    let mut out = vec![];
    if !is_bar && !is_other {
        return out;
    }
    // str_or_empty: a missing field must not become the text "undefined" (that made every bar
    // without a condition need a marker the plugin never sends → bar never shown)
    let papi = str_or_empty(get(el, "visibilityPapi"));
    let operator = js_string(Some(&or(get(el, "visibilityOperator"), json!(if is_bar { "==" } else { "always" }))));
    if !papi.trim().is_empty() && operator != "always" {
        out.push(vis_cfg(&papi, &operator, &str_or_empty(get(el, "visibilityValue")), truthy(get(el, "visibilityInvert"))));
    }
    if let Some(Value::Array(extra)) = get(el, "visibilityExtra") {
        for c in extra {
            let papi = js_string(get(c, "papi"));
            let op = js_string(Some(&or(get(c, "op"), json!("=="))));
            if papi.trim().is_empty() || op == "always" {
                continue;
            }
            out.push(vis_cfg(&papi, &op, &str_or_empty(get(c, "value")), truthy(get(c, "invert"))));
        }
    }
    out
}

/// `!=` is stored as its `==` twin that must be ABSENT, and "Invert" flips present/absent, so
/// `x != a`, `x == a` and their inverts all share one marker — and that marker is only in the
/// title while `x == a`. (Fantasy HUD armour icons: "not wearing diamond / gold / …" would
/// otherwise put five markers in the title at once for every armour slot.)
/// Returns (condition as written to config.yml, marker must be absent).
fn canonical_condition(c: VisibilityCfg) -> (VisibilityCfg, bool) {
    let mut absent = c.invert;
    let mut operator = c.operator;
    if operator == "!=" {
        operator = "==".into();
        absent = !absent;
    }
    (VisibilityCfg { operator, invert: false, ..c }, absent)
}

/// One marker per DIFFERENT condition: `v01`, `v02` … (all the same width, so `@v01` is
/// never found inside `@v010`). The plugin adds `@<key>` to the end of the bossbar title for
/// every condition that is true, and Bedrock only reads the title up to a limit — the old
/// per-element markers (`@vib_img_12`, 11–12 bytes each, one per element) ran past it on
/// packs with many conditions (HudGraveyard: 18) and those pictures / bars never showed.
/// Returns (key, condition) in element order and, per element index, its (key, must be absent)
/// list — every one of them has to hold for the element to show.
fn visibility_keys(elements: &[Value]) -> (Vec<(String, VisibilityCfg)>, Vec<Vec<(String, bool)>>) {
    let mut uniq: Vec<VisibilityCfg> = vec![];
    let mut of_el: Vec<Vec<(usize, bool)>> = vec![];
    for el in elements {
        let mut mine: Vec<(usize, bool)> = vec![];
        for raw in raw_visibility_conditions(el) {
            let (c, absent) = canonical_condition(raw);
            let i = uniq
                .iter()
                .position(|u| u.papi == c.papi && u.operator == c.operator && u.value == c.value)
                .unwrap_or_else(|| {
                    uniq.push(c);
                    uniq.len() - 1
                });
            if !mine.contains(&(i, absent)) {
                mine.push((i, absent));
            }
        }
        of_el.push(mine);
    }
    let width = uniq.len().to_string().len().max(2);
    let key = |i: usize| format!("v{:0w$}", i + 1, w = width);
    let list = uniq.into_iter().enumerate().map(|(i, mut c)| {
        c.prefix = key(i);
        (key(i), c)
    });
    (list.collect(), of_el.into_iter().map(|m| m.into_iter().map(|(i, a)| (key(i), a)).collect()).collect())
}

/// Bedrock test for the element's conditions: every marker `@key` it needs is in the bossbar
/// title (or, for a `!=` / inverted one, is not)
fn build_visibility_condition(el: &Value, elements: &[Value]) -> Option<String> {
    let idx = elements
        .iter()
        .position(|e| std::ptr::eq(e, el))
        .or_else(|| get(el, "id").and_then(|id| elements.iter().position(|e| get(e, "id") == Some(id))))?;
    let (_, keys) = visibility_keys(elements);
    let terms: Vec<String> = keys
        .get(idx)?
        .iter()
        .map(|(k, absent)| {
            if *absent {
                format!("((#bossName - '@{}') = #bossName)", k)
            } else {
                format!("(not ((#bossName - '@{}') = #bossName))", k)
            }
        })
        .collect();
    // nested pairs, `((a and b) and c)`, so the UI parser never sees a long `and` chain
    let mut it = terms.into_iter();
    let first = it.next()?;
    Some(it.fold(first, |acc, t| format!("({} and {})", acc, t)))
}

fn has_non_ascii(s: &str) -> bool {
    s.chars().any(|c| (c as u32) > 0x7f)
}

pub fn generate_kaizer_multibar_config_yml(elements: &[Value]) -> String {
    generate_kaizer_multibar_config_yml_with(elements, HudChannel::Bossbar)
}

/// config.yml for the chosen channel. Bossbar output is unchanged (no `channel:` key = bossbar,
/// which is also what KaizerMultiBar 2.0.0 does); title adds `bossbar.channel`.
pub fn generate_kaizer_multibar_config_yml_with(elements: &[Value], channel: HudChannel) -> String {
    let extra_texts = get_bossbar_slots(elements);
    let custom_bars = get_custom_bar_config_entries(elements);
    let sp = get_configured_status_prefix_map(elements);
    let mut lines: Vec<String> = vec![];
    let mut push = |s: &str| lines.push(s.to_string());

    for s in [
        "#permissions | kaizermultibar.show",
        "bossbar:",
        "  enabled: true",
        "  toggle-command: /kzbos",
        "  combine-into-one: true",
        "  update-interval: 5",
        "  # lengths below count raw UTF-8 bytes (colour codes included), like the HUD pack",
        "  length-unit: bytes",
    ] {
        push(s);
    }
    if channel != HudChannel::Bossbar {
        push("  # How the HUD data reaches Bedrock players: bossbar | title");
        push("  # Must match the option chosen when the .mcpack was exported (needs KaizerMultiBar 2.1+)");
        push(&format!("  channel: {}", channel.config_name()));
        push("  # title: sent when the data changes, and again every N ticks (0 = only on change)");
        push("  channel-resend-ticks: 100");
    }
    push(&format!("  bars-length: {}", bars_section_length(elements)));
    for s in [
        "  ",
        "  bars:",
        "    #default bar | Do not delete",
        "    health_bar:",
        "      text: \"@1%kaizerbar_hpprefix%%kaizerbar_hp%\"",
        "      pad-length: 6",
        "    food_bar:",
        "      text: \"@2%kaizerbar_foodprefix%%kaizerbar_food%\"",
        "      pad-length: 6",
        "    armor_bar:",
        "      text: \"@3ka%kaizerbar_armor%\"",
        "      pad-length: 6",
        "    oxygen_bar:",
        "      text: \"@4ko%kaizerbar_oxy%\"",
        "      pad-length: 6",
        "    exp_bar:",
        "      text: \"@5ex%kaizerbar_exp%\"",
        "      pad-length: 6",
    ] {
        push(s);
    }

    for (index, entry) in custom_bars.iter().enumerate() {
        let slot_number = index + 6;
        push(&format!("    {}_bar:", entry.key));
        push(&format!("      text: \"@{}{}%kaizerbar_{}%\"", slot_number, entry.tag, entry.tag));
        push(&format!("      pad-length: {}", custom_bar_pad(slot_number, &entry.tag)));
    }

    push("  ");
    push("  slots:");
    for (idx, slot) in extra_texts.iter().enumerate() {
        let placeholder = str_or_empty(get(slot, "papi_placeholder"));
        let pad = js_string(Some(&get_bossbar_slot_raw_length(slot)));
        let prefix = if has_non_ascii(&placeholder) { "" } else { "§z" };
        push(&format!("    slot_{}:", idx + 1));
        push(&format!("      text: \"{}{}\"", prefix, placeholder));
        push(&format!("      pad-length: {}", pad));
    }

    for (idx, np) in get_nameplate_slots(elements).iter().enumerate() {
        let placeholder = str_or_empty(get(np, "papi_placeholder"));
        let pad = js_string(Some(&get_bossbar_slot_raw_length(np)));
        let prefix = if has_non_ascii(&placeholder) { "" } else { "§z" };
        push(&format!("    nameplate_slot_{}:", idx + 1));
        push(&format!("      text: \"{}{}\"", prefix, placeholder));
        push(&format!("      pad-length: {}", pad));
    }

    push("");
    push("");
    push("bar-steps: 16");
    push("");
    push("status-prefix:");
    push("  health:");
    push(&format!("    default: \"{}\"", sp.health_default));
    push("    special:");
    let tf = |b: bool| if b { "true" } else { "false" };
    for (name, cfg) in &sp.health_special {
        push(&format!("      {}:", name));
        push(&format!("        enabled: {}", tf(cfg.enabled)));
        push(&format!("        prefix: \"{}\"", cfg.prefix));
    }
    push("    effects:");
    push(&format!("      enabled: {}", tf(sp.health_effects.values().any(|c| c.enabled))));
    for (name, cfg) in &sp.health_effects {
        push(&format!("      {}:", name));
        push(&format!("        enabled: {}", tf(cfg.enabled)));
        push(&format!("        prefix: \"{}\"", cfg.prefix));
    }
    push("  food:");
    push(&format!("    default: \"{}\"", sp.food_default));
    push("    effects:");
    push(&format!("      enabled: {}", tf(sp.food_effects.values().any(|c| c.enabled))));
    for (name, cfg) in &sp.food_effects {
        push(&format!("      {}:", name));
        push(&format!("        enabled: {}", tf(cfg.enabled)));
        push(&format!("        prefix: \"{}\"", cfg.prefix));
    }

    for s in [
        "",
        "stats:",
        "  #default stats | Do not delete",
        "  health:",
        "    max: \"%kaizerbar_maxhp%\"",
        "    current: \"%kaizerbar_currenthp%\"",
        "  food:",
        "    max: \"%kaizerbar_maxfood%\"",
        "    current: \"%kaizerbar_currentfood%\"",
        "  armor:",
        "    max: \"%kaizerbar_maxarmor%\"",
        "    current: \"%kaizerbar_currentarmor%\"",
        "  oxygen:",
        "    max: \"%kaizerbar_maxoxy%\"",
        "    current: \"%kaizerbar_currentoxy%\"",
        "",
        "",
        "custom_status:",
        "  #default custom status | Do not delete",
        "  exp:",
        "    title_pre: \"ex\"",
        "    papi: \"%player_exp%\"",
        "    max: \"1\"",
        "    current: \"%kaizerbar_currentexp%\"",
    ] {
        push(s);
    }

    for entry in &custom_bars {
        push(&format!("  {}:", entry.tag));
        push(&format!("    title_pre: \"{}\"", entry.tag));
        push(&format!("    papi: \"{}\"", entry.papi));
        push(&format!("    max: \"{}\"", entry.max));
        push(&format!("    current: \"%kaizerbar_current{}%\"", entry.tag));
    }
    push("");

    let conditions: Vec<VisibilityCfg> = visibility_keys(elements).0.into_iter().map(|(_, c)| c).collect();
    if !conditions.is_empty() {
        push("visibility-conditions:");
        for c in &conditions {
            push(&format!("  {}:", c.prefix));
            push(&format!("    papi: \"{}\"", c.papi));
            push(&format!("    operator: \"{}\"", c.operator));
            push(&format!("    value: \"{}\"", c.value));
            push(&format!("    invert: {}", tf(c.invert)));
        }
        push("");
    }

    lines.join("\n")
}

/// Returns the bar with its position taken from the parent HP / food bar.
pub fn resolve_bar_for_render(elements: &[Value], bar: &Value) -> Value {
    let bt = js_string(get(bar, "barType"));
    let parent_type = match bt.as_str() {
        "hp" | "hp_freezing" | "hp_absorption" | "hp_health_boost" | "hp_regeneration" | "hp_wither"
        | "hp_poison" => Some("hp"),
        "food" | "food_hunger" | "food_saturation" => Some("food"),
        _ => None,
    };
    if let (Some(pt), true) = (parent_type, get(bar, "barType").map_or(false, |v| v.is_string())) {
        let parent = elements
            .iter()
            .find(|e| el_type(e) == "bar" && str_eq(get(e, "barType"), pt));
        if let Some(parent) = parent {
            let same_id = match (get(parent, "id"), get(bar, "id")) {
                (Some(a), Some(b)) => a == b,
                (None, None) => true,
                _ => false,
            };
            if !same_id {
                let mut out = bar.as_object().cloned().unwrap_or_default();
                out.insert("anchor_from".into(), get(parent, "anchor_from").cloned().unwrap_or(Value::Null));
                out.insert("anchor_to".into(), get(parent, "anchor_to").cloned().unwrap_or(Value::Null));
                out.insert("offset".into(), spread(get(parent, "offset")));
                out.insert("barMaxSize".into(), spread(get(parent, "barMaxSize")));
                out.insert("layer".into(), js_add(Some(&or(get(parent, "layer"), json!(2))), Some(&json!(1))));
                // JSON.stringify drops undefined, keep parity by removing nulls we introduced
                for k in ["anchor_from", "anchor_to"] {
                    if get(parent, k).is_none() {
                        out.shift_remove(k);
                    }
                }
                return Value::Object(out);
            }
        }
    }
    bar.clone()
}

/// Bindings for a label that reads its part of OUR bossbar title directly from the
/// bossbar of its own factory instance (no `source_control_name`, so the result does
/// not depend on which bossbar comes first).
fn own_slice_bindings(range: &(String, String)) -> Value {
    let (start, end) = range;
    json!([
        {
            "binding_name": "#bossName",
            "binding_type": "collection",
            "binding_collection_name": "boss_bars"
        },
        {
            "binding_type": "view",
            // remove "prefix:" as one string; `- ':'` would also strip every ':' inside the slots
            "source_property_name": strip_bossbar_prefix(),
            "target_property_name": "#kz_s"
        },
        {
            "binding_type": "view",
            "source_property_name": format!("(('%.{}s' * #kz_s) - ('%.{}s' * #kz_s))", end, start),
            "target_property_name": "#string"
        },
        {
            "binding_type": "view",
            "source_property_name": "(#string - '&')",
            "target_property_name": "#text"
        }
    ])
}

/// A fixed 1x1 grid over the `boss_bars` collection. (`stack_panel` + `factory` +
/// `#form_button_length` comes from server_form.json and does not exist on the HUD.)
fn bossbar_factory(control_name: &str) -> Value {
    json!({
        "type": "grid",
        "collection_name": "boss_bars",
        "grid_item_template": control_name,
        "grid_dimensions": [1, 1],
        "size": ["100%", "100%"]
    })
}

/// `#visible` binding that matches our bossbar anywhere in the title, so leading
/// colour/reset codes do not hide it.
fn own_bossbar_visible_binding() -> Value {
    json!({
        "binding_type": "view",
        "source_property_name": format!("(not ((#bossName - '{}') = #bossName))", NEWBOS_PREFIX),
        "target_property_name": "#visible"
    })
}

/// Condition for fill level `i` of a bar tagged `tag`. Level 1 must not match
/// `kh10`..`kh16`, so it requires the plugin's `&` pad (or the next `@` marker) after it.
fn bar_level_condition(tag: &str, i: usize) -> String {
    if i == 1 {
        format!(
            "((not ((#bossName - '{t}1&') = #bossName)) or (not ((#bossName - '{t}1@') = #bossName)))",
            t = tag
        )
    } else {
        format!("(not ((#bossName - '{}{}') = #bossName))", tag, i)
    }
}


/// `test` = `build_visibility_condition`; the `@` check keeps it off other boss bars
fn boss_visibility_bindings(test: &str) -> Value {
    json!([
        {
            "binding_name": "#bossName",
            "binding_type": "collection",
            "binding_collection_name": "boss_bars"
        },
        {
            "binding_type": "view",
            "source_property_name": format!("((not ((#bossName - '@') = #bossName)) and {})", test),
            "target_property_name": "#visible"
        }
    ])
}

/// Sets `obj[key] = value` unless the value is `undefined` (None).
fn set_opt(obj: &mut Obj, key: &str, v: Option<&Value>) {
    if let Some(v) = v {
        obj.insert(key.into(), v.clone());
    }
}

fn lt_one(v: Option<&Value>) -> bool {
    // `x < 1.0` with JS coercion (undefined -> NaN -> false)
    let n = to_number(v);
    !n.is_nan() && n < 1.0
}

fn tex_png_path(img: &Value) -> String {
    let tp = js_string(get(img, "texturePath"));
    if tp.ends_with(".png") {
        tp
    } else {
        format!("{}.png", tp)
    }
}

/// Width / height from a PNG data URL (header only)
fn data_url_png_size(data_url: &str) -> Option<(u32, u32)> {
    use base64::Engine;
    let b64 = data_url.split_once(";base64,")?.1;
    // the first 32 base64 chars are enough for the 24-byte PNG header
    let head = &b64[..b64.len().min(44) / 4 * 4];
    let bytes = base64::engine::general_purpose::STANDARD.decode(head).ok()?;
    if bytes.len() >= 24 && &bytes[0..8] == b"\x89PNG\r\n\x1a\n" {
        let w = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
        let h = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
        return Some((w, h));
    }
    None
}

/// Frame-by-frame animation of an image element (`animFrames` = 2+ PNG data URLs):
/// (frame count, frame width, frame height, frames per second).
/// The pack gets one horizontal strip (frame 1 at the left) played by a `flip_book` animation.
pub fn image_anim(img: &Value) -> Option<(usize, u32, u32, u32)> {
    let frames = get(img, "animFrames")?.as_array()?;
    if frames.len() < 2 {
        return None;
    }
    let (w, h) = match get(img, "animFrameSize").and_then(|v| v.as_array()) {
        Some(a) if a.len() == 2 => (to_number(a.first()).round() as u32, to_number(a.get(1)).round() as u32),
        _ => data_url_png_size(frames[0].as_str()?)?,
    };
    if w == 0 || h == 0 {
        return None;
    }
    let fps = to_number(get(img, "animFps"));
    let fps = if fps.is_finite() && fps > 0.0 { fps.round().clamp(1.0, 60.0) as u32 } else { 10 };
    Some((frames.len(), w, h, fps))
}

fn unique_tex_path(img: &Value, used: &mut HashSet<String>) -> String {
    let original = tex_png_path(img);
    let mut tex = original.clone();
    let mut counter = 1;
    while used.contains(&tex) {
        tex = replace_first(&original, ".png", &format!("_{}.png", counter));
        counter += 1;
    }
    used.insert(tex.clone());
    tex
}

fn panel_wrapper(controls: Vec<Value>, bindings: &Value) -> Value {
    json!({
        "type": "panel",
        "anchor_from": "top_left",
        "anchor_to": "top_left",
        "size": ["100%", "100%"],
        "controls": controls,
        "bindings": bindings.clone()
    })
}

/// How KaizerMultiBar delivers the HUD data string to the Bedrock client.
/// The string itself ("@zelisce/custom_bossbars:" + bars + slots + markers) is the same for all.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HudChannel {
    /// Boss bar title (original): read from the `boss_bars` collection.
    Bossbar,
    /// Title: `#hud_title_text_string`, kept in a store (wiki.bedrock.dev "Preserve Title Texts").
    Title,
}

impl HudChannel {
    pub fn parse(s: &str) -> Self {
        // "actionbar" was tried and removed (2026-11-24): the pack cannot read anything inside the
        // game's action bar control, so old projects with it fall back to the boss bar
        match s.trim().to_ascii_lowercase().as_str() {
            "title" => HudChannel::Title,
            _ => HudChannel::Bossbar,
        }
    }
    pub fn from_data(data: &Value) -> Self {
        get(data, "hudChannel").and_then(|v| v.as_str()).map(Self::parse).unwrap_or(HudChannel::Bossbar)
    }
    /// Value of `bossbar.channel` in config.yml
    pub fn config_name(self) -> &'static str {
        match self {
            HudChannel::Bossbar => "bossbar",
            HudChannel::Title => "title",
        }
    }
}

/// Project-level HUD settings (not per element).
#[derive(Debug, Clone)]
pub struct HudOptions {
    /// Where the nameplate stack sits: "top_left" | "top_right" | "top_middle".
    pub nameplate_position: String,
    /// Extra push-down (GUI px) for a top_middle stack on phones, clear of the top-centre buttons.
    pub nameplate_mobile_offset: f64,
    /// How the data string reaches the client (export option, project field `hudChannel`).
    pub channel: HudChannel,
    /// Debug overlay for the action bar / title channel (project field `hudChannelDebug`).
    pub channel_debug: bool,
}

pub const DEFAULT_NAMEPLATE_MOBILE_OFFSET: f64 = 26.0;

impl Default for HudOptions {
    fn default() -> Self {
        Self {
            nameplate_position: "top_right".into(),
            nameplate_mobile_offset: DEFAULT_NAMEPLATE_MOBILE_OFFSET,
            channel: HudChannel::Bossbar,
            channel_debug: false,
        }
    }
}

impl HudOptions {
    /// Reads `nameplatePosition` / `nameplateMobileOffset` / `hudChannel` from the project data (defaults when missing).
    pub fn from_data(data: &Value) -> Self {
        let mut o = Self::default();
        o.channel = HudChannel::from_data(data);
        o.channel_debug = get(data, "hudChannelDebug").and_then(|v| v.as_bool()).unwrap_or(false);
        if let Some(p) = get(data, "nameplatePosition").and_then(|v| v.as_str()) {
            if matches!(p, "top_left" | "top_right" | "top_middle") {
                o.nameplate_position = p.to_string();
            }
        }
        let n = to_number(get(data, "nameplateMobileOffset"));
        if n.is_finite() && n >= 0.0 {
            o.nameplate_mobile_offset = n;
        }
        o
    }
}

/// The nameplate stack panel at the chosen position. top_middle uses a variable offset:
/// `$pocket_edition` (phones / tablets) pushes it down by `nameplate_mobile_offset`.
fn nameplate_stack_panel(opts: &HudOptions, controls: Vec<Value>) -> Value {
    let mut p = Obj::new();
    p.insert("type".into(), json!("stack_panel"));
    p.insert("orientation".into(), json!("horizontal"));
    match opts.nameplate_position.as_str() {
        "top_left" => {
            p.insert("anchor_from".into(), json!("top_left"));
            p.insert("anchor_to".into(), json!("top_left"));
            p.insert("offset".into(), json!([4, 2]));
        }
        "top_middle" => {
            p.insert("anchor_from".into(), json!("top_middle"));
            p.insert("anchor_to".into(), json!("top_middle"));
            p.insert("$kz_np_offset|default".into(), json!([0, 2]));
            p.insert(
                "variables".into(),
                json!([{ "requires": "$pocket_edition", "$kz_np_offset": [0, num(2.0 + opts.nameplate_mobile_offset)] }]),
            );
            p.insert("offset".into(), json!("$kz_np_offset"));
        }
        _ => {
            p.insert("anchor_from".into(), json!("top_right"));
            p.insert("anchor_to".into(), json!("top_right"));
            p.insert("offset".into(), json!([-4, 2]));
        }
    }
    p.insert("controls".into(), Value::Array(controls));
    Value::Object(p)
}

pub fn generate_hud_screen_json(namespace: &str, elements: &[Value]) -> Obj {
    generate_hud_screen_json_with(namespace, elements, &HudOptions::default())
}

pub fn generate_hud_screen_json_with(namespace: &str, elements: &[Value], opts: &HudOptions) -> Obj {
    let images = of_type(elements, "image");
    let heads = of_type(elements, "player_head");
    let slots = get_bossbar_slots(elements);
    let nameplates = get_nameplate_slots(elements);
    let bars = of_type(elements, "bar");
    let xp_labels = of_type(elements, "xp_label");

    let mut hud = Obj::new();
    hud.insert("namespace".into(), json!("hud"));
    let mut used_paths = HashSet::new();
    let panel_key = format!("{}_panel", namespace);

    let mut image_controls = vec![];
    let mut anim_defs: Vec<(String, Value)> = vec![];
    for img in &images {
        let tex = unique_tex_path(img, &mut used_paths);
        let no_ext = replace_first(&tex, ".png", "");
        let filename = no_ext.split('/').last().unwrap_or("").to_string();
        let control_name = sanitize_name(Some(&Value::String(filename)));
        let vis = build_visibility_condition(img, elements);

        let mut c = Obj::new();
        c.insert("type".into(), json!("image"));
        c.insert("texture".into(), json!(replace_first(&tex, ".png", "")));
        c.insert("size".into(), spread(get(img, "size")));
        set_opt(&mut c, "layer", get(img, "layer"));
        c.insert("offset".into(), spread(get(img, "offset")));
        set_opt(&mut c, "anchor_from", get(img, "anchor_from"));
        set_opt(&mut c, "anchor_to", get(img, "anchor_to"));
        if lt_one(get(img, "alpha")) {
            set_opt(&mut c, "alpha", get(img, "alpha"));
        }
        if truthy(get(img, "color")) {
            let col = get(img, "color").unwrap();
            let ch = |i: usize| js_round(to_number(col.get(i)) * 255.0);
            let (r, g, b) = (ch(0), ch(1), ch(2));
            if r != 255.0 || g != 255.0 || b != 255.0 {
                c.insert("color".into(), json!([num(r / 255.0), num(g / 255.0), num(b / 255.0)]));
            }
        }
        if let Some(p) = &vis {
            c.insert("bindings".into(), boss_visibility_bindings(p));
        }
        if let Some((frames, fw, fh, fps)) = image_anim(img) {
            // texture = horizontal strip of all frames; uv walks it one frame width at a time
            let key = format!("kz_anim_{}_{}", anim_defs.len() + 1, control_name);
            c.insert("uv_size".into(), json!([fw, fh]));
            c.insert("uv".into(), json!(format!("@hud.{}", key)));
            c.insert("disable_anim_fast_forward".into(), json!(true));
            anim_defs.push((
                key,
                json!({
                    "anim_type": "flip_book",
                    "initial_uv": [0, 0],
                    "frame_count": frames,
                    "frame_step": fw,
                    "fps": fps,
                    "reversible": false,
                    "easing": "linear"
                }),
            ));
        }
        let mut control = Obj::new();
        control.insert(control_name, Value::Object(c));
        image_controls.push(Value::Object(control));
    }
    // animation definitions live at the top of hud_screen.json (namespace "hud"), so the
    // `@hud.` reference also works from the split / obfuscated files
    for (k, v) in anim_defs {
        hud.insert(k, v);
    }

    let mut head_controls = vec![];
    for (i, head) in heads.iter().enumerate() {
        let mut control_name = sanitize_name(get(head, "name"));
        if control_name.is_empty() {
            control_name = format!("player_head_{}", i);
        }
        let vis = build_visibility_condition(head, elements);
        let doll_size = if truthy(get(head, "doll_size")) { spread(get(head, "doll_size")) } else { json!([75, 205]) };
        let doll_offset = if truthy(get(head, "doll_offset")) { spread(get(head, "doll_offset")) } else { json!([1, 18]) };

        let mut c = Obj::new();
        c.insert("type".into(), json!("panel"));
        set_opt(&mut c, "anchor_from", get(head, "anchor_from"));
        set_opt(&mut c, "anchor_to", get(head, "anchor_to"));
        c.insert("clips_children".into(), json!(true));
        c.insert("size".into(), spread(get(head, "size")));
        set_opt(&mut c, "layer", get(head, "layer"));
        c.insert("offset".into(), spread(get(head, "offset")));
        let mut renderer = Obj::new();
        renderer.insert(
            format!("{}_renderer", control_name),
            json!({
                "type": "custom",
                "renderer": "paper_doll_renderer",
                "size": doll_size,
                "offset": doll_offset
            }),
        );
        c.insert("controls".into(), json!([Value::Object(renderer)]));
        if let Some(p) = &vis {
            c.insert("bindings".into(), boss_visibility_bindings(p));
        }
        let mut control = Obj::new();
        control.insert(control_name, Value::Object(c));
        head_controls.push(Value::Object(control));
    }

    // The panel is created once per bossbar by `{ns}_factory`; only the instance whose
    // bossbar title starts with our prefix is shown, so other plugins' bars (in any
    // order, above or below ours) can no longer feed the HUD.
    let hud_panel_bindings = json!([
        {
            "binding_name": "#bossName",
            "binding_type": "collection",
            "binding_collection_name": "boss_bars"
        },
        own_bossbar_visible_binding()
    ]);

    if !images.is_empty() || !heads.is_empty() {
        let mut controls = image_controls;
        controls.extend(head_controls);
        hud.insert(panel_key.clone(), panel_wrapper(controls, &hud_panel_bindings));
    }

    if !bars.is_empty() {
        if !hud.contains_key(&panel_key) {
            hud.insert(panel_key.clone(), panel_wrapper(vec![], &hud_panel_bindings));
        }
        for bar in &bars {
            let resolved = resolve_bar_for_render(elements, bar);
            let tag = get_bar_default_prefix(bar, elements);
            let base = if str_eq(get(bar, "barType"), "custom") { tag.clone() } else { js_string(get(bar, "barType")) };
            let vis = build_visibility_condition(bar, elements);
            let tex_base = js_string(get(&resolved, "barTexturePath"));
            let mut bar_controls = vec![];
            for i in 1..=16 {
                let mut source = bar_level_condition(&tag, i);
                if let Some(p) = &vis {
                    // `p` is already the whole marker test (build_visibility_condition)
                    source = format!("(({}) and {})", source, p);
                }
                let mut c = Obj::new();
                c.insert("type".into(), json!("image"));
                c.insert("texture".into(), json!(format!("{}/{}", tex_base, i)));
                set_opt(&mut c, "anchor_from", get(&resolved, "anchor_from"));
                set_opt(&mut c, "anchor_to", get(&resolved, "anchor_to"));
                c.insert("size".into(), spread(get(&resolved, "barMaxSize")));
                set_opt(&mut c, "layer", get(&resolved, "layer"));
                c.insert("offset".into(), spread(get(&resolved, "offset")));
                c.insert(
                    "bindings".into(),
                    json!([
                        {
                            "binding_name": "#bossName",
                            "binding_type": "collection",
                            "binding_collection_name": "boss_bars"
                        },
                        {
                            "binding_type": "view",
                            "source_property_name": source,
                            "target_property_name": "#visible"
                        }
                    ]),
                );
                if lt_one(get(&resolved, "alpha")) {
                    set_opt(&mut c, "alpha", get(&resolved, "alpha"));
                }
                if let Some(Value::String(hex)) = get(&resolved, "barColor") {
                    let valid = hex.len() == 7
                        && hex.starts_with('#')
                        && hex[1..].chars().all(|ch| ch.is_ascii_hexdigit());
                    if valid && hex.to_uppercase() != "#FFFFFF" {
                        let h = &hex[1..];
                        let comp = |s: &str| {
                            let v = u8::from_str_radix(s, 16).unwrap_or(0) as f64;
                            js_round((v / 255.0) * 1000.0) / 1000.0
                        };
                        c.insert(
                            "color".into(),
                            json!([num(comp(&h[0..2])), num(comp(&h[2..4])), num(comp(&h[4..6])), 1]),
                        );
                    }
                }
                let mut wrapper = Obj::new();
                wrapper.insert(format!("{}_{}", base, i), Value::Object(c));
                bar_controls.push(Value::Object(wrapper));
            }
            push_controls(&mut hud, &panel_key, bar_controls);
        }
    }

    if !xp_labels.is_empty() {
        if !hud.contains_key(&panel_key) {
            hud.insert(panel_key.clone(), panel_wrapper(vec![], &hud_panel_bindings));
        }
        for (i, label) in xp_labels.iter().enumerate() {
            let mut control_name = sanitize_name(get(label, "name"));
            if control_name.is_empty() {
                control_name = format!("xp_label_{}", i);
            }
            let vis = build_visibility_condition(label, elements);
            let mut bindings = vec![json!({ "binding_name": "#level_number", "binding_type": "global" })];
            if let Some(p) = &vis {
                if let Value::Array(extra) = boss_visibility_bindings(p) {
                    bindings.extend(extra);
                }
            }
            let font_size = or(get(label, "xp_font_size"), json!("normal"));
            let lift = bedrock_middle_label_lift(font_size.as_str().unwrap_or("normal"));
            let mut c = Obj::new();
            c.insert("type".into(), json!("label"));
            c.insert("text".into(), json!("#level_number"));
            c.insert("color".into(), or(get(label, "xp_color"), json!([0.5, 1, 0.1])));
            c.insert("shadow".into(), or_undef(get(label, "xp_shadow"), json!(true)));
            c.insert("font_type".into(), json!("smooth"));
            c.insert("font_size".into(), font_size);
            // centred in the element's box (see the panel below), lifted like other centred labels
            c.insert("anchor_from".into(), json!("center"));
            c.insert("anchor_to".into(), json!("center"));
            c.insert("offset".into(), json!([0, num(lift)]));
            set_opt(&mut c, "layer", get(label, "layer"));
            c.insert("bindings".into(), Value::Array(bindings));
            // The number is centred in a panel of the element's size, placed like an image by the
            // element's own anchor and offset (same box as the preview and the Java export).
            let size = xp_box_size(label);
            let mut panel = Obj::new();
            panel.insert("type".into(), json!("panel"));
            set_opt(&mut panel, "anchor_from", get(label, "anchor_from"));
            set_opt(&mut panel, "anchor_to", get(label, "anchor_to"));
            panel.insert("offset".into(), spread(get(label, "offset")));
            panel.insert("size".into(), size);
            panel.insert("controls".into(), json!([{ "label": Value::Object(c) }]));
            let mut wrapper = Obj::new();
            wrapper.insert(control_name, Value::Object(panel));
            push_controls(&mut hud, &panel_key, vec![Value::Object(wrapper)]);
        }
    }

    if !slots.is_empty() || !nameplates.is_empty() {
        // must equal `bossbar.bars-length` written to config.yml
        let right_end = json!(bars_section_length(elements));
        hud.insert(
            "boss_health_panel".into(),
            json!({
                "$prefix": NEWBOS_PREFIX,
                "bindings": [
                    {
                        "binding_type": "collection",
                        "binding_collection_name": "boss_bars",
                        "binding_name": "#bar_visible"
                    },
                    {
                        "binding_type": "collection",
                        "binding_collection_name": "boss_bars",
                        "binding_name": "#bossName"
                    },
                    {
                        "binding_type": "view",
                        "source_property_name": "(((#bossName - $prefix) = #bossName) and #bar_visible)",
                        "target_property_name": "#visible"
                    }
                ]
            }),
        );
        hud.insert("custom_bossbars_factory".into(), bossbar_factory("hud.custom_bossbars_panel"));

        let mut panel_bindings = vec![
            json!({
                "binding_type": "collection",
                "binding_collection_name": "boss_bars",
                "binding_name": "#bossName"
            }),
            own_bossbar_visible_binding(),
            json!({
                "binding_type": "view",
                "source_property_name": strip_bossbar_prefix(),
                "target_property_name": "#string"
            }),
            json!({
                "binding_type": "view",
                "source_property_name": format!("('%.{}s' * #string - '&')", js_string(Some(&right_end))),
                "target_property_name": "#right_string"
            }),
        ];

        let mut slot_start = right_end;
        let mut slot_ranges: Vec<(String, String)> = vec![];
        for (idx, slot) in slots.iter().enumerate() {
            let len = get_bossbar_slot_raw_length(slot);
            let start = slot_start.clone();
            let end = js_add(Some(&start), Some(&len));
            slot_ranges.push((js_string(Some(&start)), js_string(Some(&end))));
            panel_bindings.push(json!({
                "binding_type": "view",
                "source_property_name": format!("(('%.{}s' * #string) - ('%.{}s' * #string))", js_string(Some(&end)), js_string(Some(&start))),
                "target_property_name": format!("#left_string_{}", idx + 1)
            }));
            slot_start = end;
        }
        let mut np_start = slot_start;
        let mut np_ranges: Vec<(String, String)> = vec![];
        for (idx, np) in nameplates.iter().enumerate() {
            let len = get_bossbar_slot_raw_length(np);
            let start = np_start.clone();
            let end = js_add(Some(&start), Some(&len));
            np_ranges.push((js_string(Some(&start)), js_string(Some(&end))));
            panel_bindings.push(json!({
                "binding_type": "view",
                "source_property_name": format!("(('%.{}s' * #string) - ('%.{}s' * #string))", js_string(Some(&end)), js_string(Some(&start))),
                "target_property_name": format!("#nameplate_string_{}", idx + 1)
            }));
            np_start = end;
        }

        hud.insert(
            "custom_bossbars_panel".into(),
            json!({
                "type": "panel",
                "$prefix": NEWBOS_PREFIX,
                "size": ["100%", "100%"],
                "bindings": panel_bindings,
                "controls": []
            }),
        );

        // All nameplates share one horizontal stack at the project's nameplate position
        // (top_left / top_right / top_middle; top_middle is pushed down on phones, see nameplate_stack_panel).
        let mut nameplate_stack: Option<Value> = None;
        if !nameplates.is_empty() {
            let mut stack_controls = vec![];
            for idx in 0..nameplates.len() {
                let n = idx + 1;
                if idx > 0 {
                    let mut o = Obj::new();
                    o.insert(format!("spacer{}@hud.nameplate_slot_sp_text_panel", n), json!({}));
                    stack_controls.push(Value::Object(o));
                }
                let mut o = Obj::new();
                o.insert(format!("slot{}@hud.nameplate_slot_{}_text_panel", n, n), json!({}));
                stack_controls.push(Value::Object(o));
            }
            nameplate_stack = Some(json!({ "nameplate_slot_panel": nameplate_stack_panel(opts, stack_controls) }));
            hud.insert("nameplate_slot_sp_text_panel".into(), json!({ "type": "panel", "size": [1, 1] }));
            for idx in 0..nameplates.len() {
                let n = idx + 1;
                hud.insert(
                    format!("nameplate_slot_{}_text_panel", n),
                    json!({
                        "type": "panel",
                        "size": ["100%cm + 6px", "17px"],
                        "controls": [
                            {
                                "label": {
                                    "type": "label",
                                    "text": "#text",
                                    "font_size": "normal",
                                    "layer": 1,
                                    "offset": [3, 0],
                                    "bindings": own_slice_bindings(&np_ranges[idx])
                                }
                            },
                            {
                                "bg": {
                                    "type": "image",
                                    "texture": "textures/ui/hud_tip_text_background",
                                    "alpha": 0.6,
                                    "layer": -1,
                                    "anchor_from": "top_right",
                                    "anchor_to": "top_right",
                                    "size": ["100%sm + 7px", "100%"],
                                    "bindings": [
                                        {
                                            "binding_type": "view",
                                            "source_control_name": "label",
                                            "resolve_sibling_scope": true,
                                            "source_property_name": "(not (#text = ''))",
                                            "target_property_name": "#visible"
                                        }
                                    ]
                                }
                            }
                        ]
                    }),
                );
            }
        }

        let mut all_controls: Vec<Value> = vec![];
        for (idx, slot) in slots.iter().enumerate() {
            let n = idx + 1;
            let color = or(get(slot, "color"), json!([1, 1, 1]));
            let font_size = or(get(slot, "font_size"), json!("normal"));
            let shadow = or_undef(get(slot, "shadow"), json!(false));
            let pos_from = or(get(slot, "anchor_from"), json!("top_left"));
            let pos_to = or(get(slot, "anchor_to"), pos_from.clone());
            let text_from = or(get(slot, "text_anchor_from"), json!("top_left"));
            let text_to = or(get(slot, "text_anchor_to"), text_from.clone());
            let offset = if truthy(get(slot, "offset")) { spread(get(slot, "offset")) } else { json!([0, 0]) };
            let label_offset = text_offset_delta(slot, font_size.as_str().unwrap_or("normal"), text_from.as_str().unwrap_or("top_left"));
            let mut o = Obj::new();
            o.insert(
                format!("slot_{}", n),
                json!({
                    "type": "panel",
                    "anchor_from": pos_from,
                    "anchor_to": pos_to,
                    "offset": offset,
                    "size": [1, 1],
                    "controls": [
                        {
                            "label": {
                                "type": "label",
                                "text": "#text",
                                // the parent panel is 1x1; without this the label is 1px wide and shows "..."
                                "size": ["default", "default"],
                                "anchor_from": text_from,
                                "anchor_to": text_to,
                                // text_offset relative to its default (same rule as the Java export)
                                "offset": label_offset,
                                "color": spread(Some(&color)),
                                "shadow": shadow,
                                "font_size": font_size,
                                "layer": or(get(slot, "layer"), json!(101)),
                                "bindings": own_slice_bindings(&slot_ranges[idx])
                            }
                        }
                    ]
                }),
            );
            all_controls.push(Value::Object(o));
        }
        if let Some(ns) = nameplate_stack {
            all_controls.push(ns);
        }
        if let Some(Value::Object(p)) = hud.get_mut("custom_bossbars_panel") {
            p.insert("controls".into(), Value::Array(all_controls));
        }
    }

    if hud.contains_key(&panel_key) {
        hud.insert(format!("{}_factory", namespace), bossbar_factory(&format!("hud.{}", panel_key)));
    }
    if !images.is_empty() || !heads.is_empty() || !bars.is_empty() || !slots.is_empty() || !nameplates.is_empty() || !xp_labels.is_empty() {
        let mut first = Obj::new();
        if hud.contains_key(&panel_key) {
            first.insert(format!("{}_factory@hud.{}_factory", namespace, namespace), json!({}));
        }
        let mut root_mods = vec![];
        if !first.is_empty() {
            root_mods.push(json!({
                "array_name": "controls",
                "operation": "insert_front",
                "value": Value::Object(first)
            }));
        }
        if !slots.is_empty() || !nameplates.is_empty() {
            root_mods.push(json!({
                "array_name": "controls",
                "operation": "insert_back",
                "value": { "custom_bossbars_factory@hud.custom_bossbars_factory": {} }
            }));
        }
        hud.insert("root_panel".into(), json!({ "modifications": root_mods }));
    }

    let has_bt = |t: &str| bars.iter().any(|b| str_eq(get(b, "barType"), t));
    let has_hp = has_bt("hp");
    let has_food = has_bt("food");
    let has_armor = has_bt("armor");
    let has_air = has_bt("air");
    let has_exp_bar = bars
        .iter()
        .any(|b| str_eq(get(b, "barType"), "exp") || str_eq(get(b, "barCustomTag"), "ex"));
    let has_exp = has_exp_bar || !xp_labels.is_empty();

    if has_hp || has_food || has_armor || has_air || has_exp {
        hud.insert(
            "centered_gui_elements_at_bottom_middle".into(),
            json!({
                "type": "panel",
                "anchor_from": "bottom_middle",
                "anchor_to": "bottom_middle",
                "size": [180, 50],
                "controls": build_bottom_middle_controls(has_hp, has_food, has_armor, has_air, has_exp, false)
            }),
        );
        hud.insert(
            "centered_gui_elements_at_bottom_middle_touch".into(),
            json!({
                "type": "panel",
                "anchor_from": "bottom_middle",
                "anchor_to": "bottom_middle",
                "size": [180, 51],
                "controls": build_bottom_middle_controls(has_hp, has_food, has_armor, has_air, has_exp, true)
            }),
        );
    }

    if !heads.is_empty() {
        hud.insert(
            "centered_gui_elements".into(),
            json!({
                "type": "panel",
                "controls": [
                    {
                        "hud_player_rend_desktop@hud_player_renderer": {
                            "offset": "$hud_player_rend_desktop_offset",
                            "anchor_from": "top_left",
                            "anchor_to": "top_left"
                        }
                    }
                ],
                "bindings": [
                    {
                        "binding_name": "#hud_visible_centered_gui_elements",
                        "binding_name_override": "#visible",
                        "binding_type": "global"
                    }
                ],
                "modifications": [
                    {
                        "array_name": "controls",
                        "operation": "remove",
                        "control_name": "hud_player_rend_desktop"
                    }
                ]
            }),
        );
        let entry = hud
            .entry("not_centered_gui_elements".to_string())
            .or_insert_with(|| json!({ "modifications": [] }));
        if let Some(Value::Array(m)) = entry.get_mut("modifications") {
            m.push(json!({
                "array_name": "controls",
                "operation": "remove",
                "control_name": "hud_player_rend_pocket"
            }));
        }
    }

    hud.insert(
        "boss_name_panel".into(),
        json!({
            "type": "panel",
            "size": ["100%", "100%c"],
            "anchor_from": "top_middle",
            "anchor_to": "top_middle",
            "controls": [
                {
                    "boss_name": {
                        "type": "label",
                        "color": "$boss_name_text_color",
                        "enable_profanity_filter": true,
                        "text": "#bossName",
                        "anchor_from": "top_middle",
                        "anchor_to": "top_middle",
                        "shadow": true,
                        "bindings": [
                            {
                                "binding_name": "#bossName",
                                "binding_type": "collection",
                                "binding_collection_name": "boss_bars"
                            },
                            {
                                "binding_type": "view",
                                "source_property_name": "((#bossName - '@') = #bossName)",
                                "target_property_name": "#visible"
                            }
                        ]
                    }
                }
            ]
        }),
    );

    if has_exp_bar {
        hud.insert(
            "hotbar".into(),
            json!({
                "type": "panel",
                "anchor_from": "bottom_middle",
                "anchor_to": "bottom_middle",
                "controls": [{ "hotbar_chooser@hotbar_chooser": {} }]
            }),
        );
        for k in ["empty_progress_bar", "progress_bar_nub", "full_progress_bar"] {
            hud.insert(k.into(), json!({ "type": "image", "texture": "textures/ui/xpbarempty" }));
        }
    }

    // Hotbar selection under the item, like Java: vanilla draws selected_hotbar_slot at layer 8,
    // above the item icon (layer 3) and its count (4), so a pack whose selection is a filled box
    // (Simple HUD) hid the selected item. Layer 2 keeps it above the slot background (1).
    hud.insert("hotbar_slot_selected_image".into(), json!({ "layer": 2 }));

    if !xp_labels.is_empty() {
        hud.insert(
            "progress_text_label".into(),
            json!({
                "bindings": [
                    {
                        "binding_type": "view",
                        "source_property_name": "(false)",
                        "target_property_name": "#visible"
                    }
                ]
            }),
        );
    }

    hud.insert(
        "progress_bar".into(),
        json!({
            "modifications": [
                {
                    "array_name": "bindings",
                    "operation": "insert_back",
                    "value": {
                        "binding_type": "view",
                        "source_property_name": "((#bossName - '@') = #bossName)",
                        "target_property_name": "#visible"
                    }
                }
            ]
        }),
    );

    // The editor names the side anchors middle_left / middle_right; Bedrock only knows
    // left_middle / right_middle and falls back to center for anything else
    // (measured with the calibration project 2026-11-22).
    let mut v = Value::Object(hud);
    fix_bedrock_anchors(&mut v);
    match v {
        Value::Object(o) => o,
        _ => unreachable!(),
    }
}

/// Box the XP level number is centred in: the element's size, except the old default 20×10
/// (which never matched the 12×9 box templates computed the offset for) → 12×9.
/// Mirrors app.js xpBoxSize and javaexport.js.
fn xp_box_size(label: &Value) -> Value {
    let s = get(label, "size").and_then(|v| v.as_array());
    let w = s.map(|a| to_number(a.first())).unwrap_or(f64::NAN);
    let h = s.map(|a| to_number(a.get(1))).unwrap_or(f64::NAN);
    if !(w > 0.0) || !(h > 0.0) || (w == 20.0 && h == 10.0) {
        return json!([12, 9]);
    }
    json!([num(w), num(h)])
}

/// Bedrock anchor name for an editor anchor name (both spellings accepted).
fn bedrock_anchor(a: &str) -> &str {
    match a {
        "middle_left" => "left_middle",
        "middle_right" => "right_middle",
        other => other,
    }
}

/// Rewrites every `anchor_from` / `anchor_to` string in the generated UI to Bedrock's names.
fn fix_bedrock_anchors(v: &mut Value) {
    match v {
        Value::Object(o) => {
            for (k, val) in o.iter_mut() {
                if k == "anchor_from" || k == "anchor_to" {
                    if let Value::String(s) = val {
                        let fixed = bedrock_anchor(s).to_string();
                        *s = fixed;
                    }
                } else {
                    fix_bedrock_anchors(val);
                }
            }
        }
        Value::Array(a) => a.iter_mut().for_each(fix_bedrock_anchors),
        _ => {}
    }
}

fn push_controls(hud: &mut Obj, panel_key: &str, items: Vec<Value>) {
    if let Some(Value::Object(p)) = hud.get_mut(panel_key) {
        if let Some(Value::Array(c)) = p.get_mut("controls") {
            c.extend(items);
        }
    }
}

fn build_bottom_middle_controls(has_hp: bool, has_food: bool, has_armor: bool, has_air: bool, has_exp: bool, is_touch: bool) -> Vec<Value> {
    let t = |touch: i64, desk: i64| if is_touch { touch } else { desk };
    let mut list = vec![];
    if !has_hp {
        list.push(json!({
            "heart_rend@heart_renderer": {
                "offset": [-1, t(-41, -40)],
                "anchor_from": "bottom_left",
                "anchor_to": "bottom_left"
            }
        }));
        list.push(json!({
            "horse_heart_rend_0@horse_heart_renderer": {
                "offset": [180, t(-57, -56)],
                "anchor_from": "bottom_left",
                "anchor_to": "bottom_left",
                "bindings": [
                    { "binding_name": "#creative_horse_hearts", "binding_name_override": "#visible" }
                ]
            }
        }));
        list.push(json!({
            "horse_heart_rend_1@horse_heart_renderer": {
                "offset": [180, t(-51, -50)],
                "anchor_from": "bottom_left",
                "anchor_to": "bottom_left",
                "bindings": [
                    { "binding_name": "#show_survival_ui", "binding_name_override": "#visible" }
                ]
            }
        }));
    }
    if !has_food {
        list.push(json!({
            "hunger_rend@hunger_renderer": {
                "offset": [180, t(-41, -40)],
                "anchor_from": "bottom_left",
                "anchor_to": "bottom_left"
            }
        }));
    }
    if !has_armor {
        list.push(json!({
            "armor_rend@armor_renderer": {
                "offset": [-1, t(-51, -50)],
                "anchor_from": "bottom_left",
                "anchor_to": "bottom_left"
            }
        }));
    }
    if !has_air {
        list.push(json!({
            "bubbles_rend_0@bubbles_renderer": {
                "offset": [180, t(-51, -50)],
                "anchor_from": "bottom_left",
                "anchor_to": "bottom_left",
                "bindings": [{ "binding_name": "#is_not_riding", "binding_name_override": "#visible" }]
            }
        }));
        list.push(json!({
            "bubbles_rend_1@bubbles_renderer": {
                "offset": [180, t(-61, -60)],
                "anchor_from": "bottom_left",
                "anchor_to": "bottom_left",
                "bindings": [{ "binding_name": "#is_riding", "binding_name_override": "#visible" }]
            }
        }));
    }
    let hide = json!({
        "binding_type": "view",
        "source_property_name": "(false)",
        "target_property_name": "#visible"
    });
    if is_touch {
        let mut exp = Obj::new();
        exp.insert("anchor_from".into(), json!("bottom_middle"));
        exp.insert("anchor_to".into(), json!("bottom_middle"));
        if has_exp {
            exp.insert("bindings".into(), json!([hide.clone()]));
        }
        let mut w = Obj::new();
        w.insert("exp_rend@exp_progress_bar_and_hotbar".into(), Value::Object(exp));
        list.push(Value::Object(w));
        let mut bindings = vec![
            json!({ "binding_name": "#is_creative_mode", "binding_name_override": "#visible" }),
            json!({ "binding_name": "#hotbar_is_resizable", "binding_name_override": "#visible" }),
        ];
        if has_exp {
            bindings.push(hide);
        }
        list.push(json!({
            "exp_rend_resizable@exp_progress_bar_and_hotbar_pocket": { "bindings": bindings }
        }));
    } else {
        let mut exp = Obj::new();
        if has_exp {
            exp.insert("bindings".into(), json!([hide]));
        }
        let mut w = Obj::new();
        w.insert("exp_rend@exp_progress_bar_and_hotbar".into(), Value::Object(exp));
        list.push(Value::Object(w));
    }
    list
}

/// Output files of the resource pack UI: path → JSON content (insertion ordered).
pub type Files = IndexMap<String, Value>;

#[allow(dead_code)]
pub fn generate_split_files(namespace: &str, elements: &[Value]) -> Files {
    generate_split_files_patched(namespace, elements, None)
}

/// Same as `generate_split_files`, with the user's hud_screen.json override
/// applied to the generated HUD.
pub fn generate_split_files_patched(namespace: &str, elements: &[Value], hud_patch: Option<&Value>) -> Files {
    generate_split_files_patched_with(namespace, elements, hud_patch, &HudOptions::default())
}

/// Same as `generate_split_files_patched`, with the project's HUD settings.
pub fn generate_split_files_patched_with(
    namespace: &str,
    elements: &[Value],
    hud_patch: Option<&Value>,
    opts: &HudOptions,
) -> Files {
    let mut hud = generate_hud_screen_json_with(namespace, elements, opts);
    if let Some(patch) = hud_patch {
        let mut v = Value::Object(hud);
        crate::overrides::apply(&mut v, patch);
        hud = match v {
            Value::Object(o) => o,
            _ => Obj::new(),
        };
    }

    let mut files = Files::new();
    files.insert("ui/hud_screen.json".into(), Value::Object(hud));
    // hud_screen.json is a vanilla screen file and is merged automatically
    files.insert("ui/_ui_defs.json".into(), json!({ "ui_defs": [] }));
    apply_hud_channel_with(&mut files, opts.channel, opts.channel_debug);
    files
}

/* ───────────── data channel: title instead of the boss bar ─────────────
 * Every reader of the data string uses `#bossName` from the `boss_bars` collection. For the
 * title channel the pack keeps the last title that contains our prefix in one hidden panel
 * (`kz_hud_store`, property `#kz_saved`) and each reader gets its `#bossName` from there, so
 * all the slicing / marker expressions stay exactly the same. The factory grids over
 * `boss_bars` become plain panels with one instance, and the vanilla boss bar overrides are
 * dropped (other plugins' boss bars show normally again).
 *
 * An action bar channel was tried and removed (2026-11-24, CHANGELOG (30)/(31)): bindings can
 * not find any control inside the game's action bar control (even a constant), and
 * `$actionbar_text` only exists inside it, so the data could not be kept apart from other
 * plugins' action bar messages.
 */

/// Name of the hidden panel that keeps the last data string.
const KZ_STORE: &str = "kz_hud_store";
/// `/kzbos` toggle-off payload: subtracting it leaves no prefix → HUD hidden.
const KZ_OFF_SUFFIX: &str = ":~off";

fn is_bossbar_collection_binding(b: &Value) -> bool {
    str_eq(get(b, "binding_collection_name"), "boss_bars") && str_eq(get(b, "binding_name"), "#bossName")
}

/// `#bossName` read from the store instead of a boss bar.
fn store_bossname_binding() -> Value {
    json!({
        "binding_type": "view",
        "source_control_name": KZ_STORE,
        "source_property_name": format!("(#kz_saved - '{}{}')", NEWBOS_PREFIX, KZ_OFF_SUFFIX),
        "target_property_name": "#bossName"
    })
}

/// Rewrites one value tree: collection `#bossName` → store, `boss_bars` grid → single instance.
fn rewrite_bossbar_reads(v: &mut Value) {
    match v {
        Value::Object(o) => {
            let is_grid = str_eq(o.get("type"), "grid") && str_eq(o.get("collection_name"), "boss_bars");
            if is_grid {
                let template = js_string(o.get("grid_item_template"));
                let mut inst = Obj::new();
                inst.insert(format!("kz_hud_instance@{}", template), json!({}));
                *v = json!({ "type": "panel", "size": ["100%", "100%"], "controls": [Value::Object(inst)] });
                return;
            }
            if let Some(Value::Array(bindings)) = o.get_mut("bindings") {
                for b in bindings.iter_mut() {
                    if is_bossbar_collection_binding(b) {
                        *b = store_bossname_binding();
                    }
                }
            }
            for (_, child) in o.iter_mut() {
                rewrite_bossbar_reads(child);
            }
        }
        Value::Array(a) => {
            for child in a.iter_mut() {
                rewrite_bossbar_reads(child);
            }
        }
        _ => {}
    }
}

/// True when `src` (an expression of a string) contains our prefix.
fn has_prefix_expr(src: &str) -> String {
    format!("(not (({s} - '{p}') = {s}))", s = src, p = NEWBOS_PREFIX)
}

/// The store (wiki.bedrock.dev "Preserve Title Texts"): saves the title when it has our prefix
/// and differs from the saved one (the copy binding only runs on `visibility_changed`; the panel
/// turns visible for that one update and hides again because the strings are then equal).
fn hud_store_control() -> Value {
    json!({
        "type": "panel",
        "size": [0, 0],
        "property_bag": { "#kz_saved": "" },
        "bindings": [
            { "binding_name": "#hud_title_text_string", "binding_type": "global" },
            {
                "binding_name": "#hud_title_text_string",
                "binding_name_override": "#kz_saved",
                "binding_type": "global",
                "binding_condition": "visibility_changed"
            },
            {
                "binding_type": "view",
                "source_property_name": format!(
                    "((not (#hud_title_text_string = #kz_saved)) and {})",
                    has_prefix_expr("#hud_title_text_string")
                ),
                "target_property_name": "#visible"
            }
        ]
    })
}

/// Debug overlay (export option "Debug text"): a yellow label at the top of the screen with the
/// title the pack receives and what the store keeps, and the vanilla title is NOT hidden.
fn channel_debug_label() -> Value {
    json!({
        "type": "label",
        "text": "#text",
        "color": [1, 1, 0],
        "shadow": true,
        "font_size": "small",
        "layer": 200,
        "anchor_from": "top_middle",
        "anchor_to": "top_middle",
        "offset": [0, 34],
        "size": ["default", "default"],
        "bindings": [
            { "binding_name": "#hud_title_text_string", "binding_type": "global" },
            {
                "binding_type": "view",
                "source_control_name": KZ_STORE,
                "source_property_name": "#kz_saved",
                "target_property_name": "#kz_saved"
            },
            {
                "binding_type": "view",
                "source_property_name": "('KZ title | in: ' + ('%.24s' * #hud_title_text_string) + ' | saved: ' + ('%.24s' * #kz_saved))",
                "target_property_name": "#text"
            }
        ]
    })
}

pub fn apply_hud_channel_with(files: &mut Files, channel: HudChannel, debug: bool) {
    if channel == HudChannel::Bossbar {
        return;
    }
    for (path, v) in files.iter_mut() {
        if path.ends_with(".json") && path != "ui/_ui_defs.json" {
            if path == "ui/hud_screen.json" {
                if let Value::Object(o) = v {
                    // vanilla boss bar overrides only exist to hide OUR boss bar
                    for k in ["boss_health_panel", "boss_name_panel", "progress_bar"] {
                        o.shift_remove(k);
                    }
                }
            }
            rewrite_bossbar_reads(v);
        }
    }
    let screen = match files.get_mut("ui/hud_screen.json") {
        Some(Value::Object(o)) => o,
        _ => return,
    };
    // one object per control, like the wiki examples
    let mut added: Vec<Value> = vec![json!({ format!("{}@hud.{}", KZ_STORE, KZ_STORE): {} })];
    if !debug {
        // hide the vanilla title (and its subtitle) while it shows our data string
        screen.insert(
            "hud_title_text".into(),
            json!({
                "bindings": [
                    { "binding_name": "#hud_title_text_string", "binding_type": "global" },
                    {
                        "binding_type": "view",
                        "source_property_name": format!("(not {})", has_prefix_expr("#hud_title_text_string")),
                        "target_property_name": "#visible"
                    }
                ]
            }),
        );
    }
    screen.insert(KZ_STORE.into(), hud_store_control());
    if debug {
        screen.insert("kz_channel_debug".into(), channel_debug_label());
        added.push(json!({ "kz_channel_debug@hud.kz_channel_debug": {} }));
    }
    let root = screen.entry("root_panel".to_string()).or_insert_with(|| json!({ "modifications": [] }));
    if let Value::Object(r) = root {
        let mods = r.entry("modifications".to_string()).or_insert_with(|| json!([]));
        if let Value::Array(m) = mods {
            m.push(json!({ "array_name": "controls", "operation": "insert_back", "value": added }));
        }
    }
}

#[allow(dead_code)]
pub fn generate_manifest_json(namespace: &str) -> Value {
    generate_manifest_json_with(namespace, None)
}

/// `uuids` = [header, module]; random when not given (one per export, like the web version).
pub fn generate_manifest_json_with(namespace: &str, uuids: Option<[String; 2]>) -> Value {
    let [u1, u2] = uuids.unwrap_or_else(|| [uuid::Uuid::new_v4().to_string(), uuid::Uuid::new_v4().to_string()]);
    let name = if namespace.is_empty() { "custom_hud" } else { namespace };
    let version = json!([1, 0, 0]);
    json!({
        "format_version": 2,
        "header": {
            "description": "§7Made with JsonUI Maker",
            "name": format!("§l§c{}", name),
            "uuid": u1,
            "version": version.clone(),
            "min_engine_version": [1, 16, 2]
        },
        "modules": [
            {
                "description": "§7Made with JsonUI Maker",
                "type": "resources",
                "uuid": u2,
                "version": version
            }
        ]
    })
}

#[cfg(test)]
mod order_tests {
    use super::*;

    fn sample() -> Vec<Value> {
        serde_json::from_value(json!([
            { "id": 1, "type": "image", "name": "bg", "texturePath": "textures/ns/bg", "size": [10, 10], "offset": [0, 0],
              "anchor_from": "top_left", "anchor_to": "top_left", "layer": 100 },
            { "id": 2, "type": "bar", "name": "hp", "barType": "hp", "barTexturePath": "textures/hotbar/fill_kh/horizontal/16",
              "barMaxSize": [40, 5], "size": [40, 5], "offset": [0, 0], "anchor_from": "top_left", "anchor_to": "top_left", "layer": 101 },
            { "id": 3, "type": "text", "name": "t", "collection_index": 0, "pad_auto": false, "pad_length": 30, "papi_placeholder": "%player_name%",
              "offset": [5, 5], "anchor_from": "top_left", "anchor_to": "top_left" },
            { "id": 4, "type": "nameplate", "name": "np", "collection_index": 0, "pad_auto": false, "pad_length": 30, "papi_placeholder": "%x%" }
        ]))
        .unwrap()
    }

    #[test]
    fn manifest_version_is_1_0_0() {
        let m = generate_manifest_json("ns");
        assert_eq!(m["header"]["version"], json!([1, 0, 0]));
        assert_eq!(m["modules"][0]["version"], json!([1, 0, 0]));
    }

    /// Slots start right after the real bars section, and config.yml tells the plugin the same length.
    #[test]
    fn bars_section_is_tight_and_matches_config() {
        let els = sample();
        assert_eq!(bars_section_length(&els), 30);
        let yml = generate_kaizer_multibar_config_yml(&els);
        assert!(yml.contains("  bars-length: 30\n"));
        assert!(yml.contains("  length-unit: bytes\n"));
        let hud = Value::Object(generate_hud_screen_json("ns", &els));
        let boss = serde_json::to_string(&hud["custom_bossbars_panel"]["bindings"]).unwrap();
        assert!(boss.contains("('%.30s' * #string - '&')"));
        assert!(boss.contains("(('%.60s' * #string) - ('%.30s' * #string))"), "slot 1 = 30..60");
        assert!(boss.contains("((#bossName - '\u{a7}r@zelisce/custom_bossbars:') - '@zelisce/custom_bossbars:')"), "':' inside slots must survive; Geyser's leading reset is stripped");
        assert!(!boss.contains("- ':'"));
        let slot = &hud["custom_bossbars_panel"]["controls"][0]["slot_1"]["controls"][0]["label"];
        assert_eq!(slot["size"], json!(["default", "default"]));
        assert_eq!(bossbar_title_length(&els), 25 + 30 + 30 + 30);
        // custom bar #10 needs 7 chars (@10ca16)
        assert_eq!(custom_bar_pad(10, "ca"), 7);
        assert_eq!(custom_bar_pad(6, "ca"), 6);
    }

    /// Nameplates always form one stack at the project's position; the element's own
    /// anchor / offset / lockPosition are ignored. top_middle is pushed down on phones.
    #[test]
    fn nameplate_positions() {
        let els: Vec<Value> = vec![
            json!({ "id": 1, "type": "nameplate", "name": "a", "collection_index": 0, "pad_length": 16, "papi_placeholder": "%a%",
                    "lockPosition": true, "anchor_from": "top_right", "anchor_to": "top_right", "offset": [-4, 5], "size": [60, 15] }),
            json!({ "id": 2, "type": "nameplate", "name": "b", "collection_index": 1, "pad_length": 16, "papi_placeholder": "%b%",
                    "lockPosition": false, "anchor_from": "middle_left", "anchor_to": "middle_left", "offset": [4, 60], "size": [60, 15] }),
        ];
        let stack_for = |data: Value| -> Value {
            let opts = HudOptions::from_data(&data);
            let hud = Value::Object(generate_hud_screen_json_with("ns", &els, &opts));
            let ctrls = hud["custom_bossbars_panel"]["controls"].as_array().unwrap().clone();
            assert!(!serde_json::to_string(&hud).unwrap().contains("nameplate_free"));
            ctrls.iter().find_map(|c| c.get("nameplate_slot_panel").cloned()).expect("stack")
        };

        // default (missing) = top_right, both slots in the stack
        let s = stack_for(json!({}));
        assert_eq!(s["anchor_from"], "top_right");
        assert_eq!(s["offset"], json!([-4, 2]));
        let t = serde_json::to_string(&s).unwrap();
        assert!(t.contains("slot1@hud.nameplate_slot_1_text_panel") && t.contains("slot2@hud.nameplate_slot_2_text_panel"));

        let s = stack_for(json!({ "nameplatePosition": "top_left" }));
        assert_eq!(s["anchor_from"], "top_left");
        assert_eq!(s["anchor_to"], "top_left");
        assert_eq!(s["offset"], json!([4, 2]));

        let s = stack_for(json!({ "nameplatePosition": "top_middle" }));
        assert_eq!(s["anchor_from"], "top_middle");
        assert_eq!(s["offset"], "$kz_np_offset");
        assert_eq!(s["$kz_np_offset|default"], json!([0, 2]));
        assert_eq!(s["variables"][0]["requires"], "$pocket_edition");
        assert_eq!(s["variables"][0]["$kz_np_offset"], json!([0, 28]));

        let s = stack_for(json!({ "nameplatePosition": "top_middle", "nameplateMobileOffset": 40 }));
        assert_eq!(s["variables"][0]["$kz_np_offset"], json!([0, 42]));
        assert_eq!(stack_for(json!({ "nameplatePosition": "bogus" }))["anchor_from"], "top_right");
    }

    /// Pad length follows the placeholders unless pad_auto is false; config.yml and the slices agree.
    #[test]
    fn auto_pad_lengths() {
        assert_eq!(auto_pad_length("%player_health_rounded%"), 7); // §z + 4
        assert_eq!(auto_pad_length("%player_health_rounded%/%player_max_health_rounded%"), 12);
        assert_eq!(auto_pad_length("%player_food_level%/20"), 8);
        assert_eq!(auto_pad_length("%player_remaining_air%/%player_max_air%"), 10);
        assert_eq!(auto_pad_length("%auraskills_mana_int%/%auraskills_mana_max_int%"), 14);
        assert_eq!(auto_pad_length("%player_level%"), 8);
        assert_eq!(auto_pad_length("%player_name%"), 20);
        assert_eq!(auto_pad_length("%vault_eco_balance_formatted%"), 11);
        assert_eq!(auto_pad_length("%server_time_HH:mm%"), 8);
        assert_eq!(auto_pad_length("%player_x% %player_y% %player_z%"), 32);
        assert_eq!(auto_pad_length("&aHP %player_health_rounded%"), 3 + 3 + 3 + 4);
        assert_eq!(auto_pad_length("%some_unknown%"), 19);
        assert_eq!(auto_pad_length("เลือด %player_health_rounded%"), 15 + 1 + 4, "Thai text: no §z, 3 bytes per char");

        let els: Vec<Value> = vec![
            json!({ "id": 1, "type": "text", "name": "hp", "collection_index": 0, "pad_length": 30, "papi_placeholder": "%player_health_rounded%" }),
            json!({ "id": 2, "type": "text", "name": "xyz", "collection_index": 1, "pad_auto": false, "pad_length": 40, "papi_placeholder": "%player_x% %player_y% %player_z%" }),
            json!({ "id": 3, "type": "nameplate", "name": "np", "collection_index": 0, "papi_placeholder": "%player_name%" }),
        ];
        let yml = generate_kaizer_multibar_config_yml(&els);
        assert!(yml.contains("    slot_1:\n      text: \"§z%player_health_rounded%\"\n      pad-length: 7\n"), "{}", yml);
        assert!(yml.contains("    slot_2:\n      text: \"§z%player_x% %player_y% %player_z%\"\n      pad-length: 40\n"));
        assert!(yml.contains("    nameplate_slot_1:\n      text: \"§z%player_name%\"\n      pad-length: 20\n"));
        let bars = bars_section_length(&els);
        assert_eq!(bossbar_title_length(&els), 25 + bars + 7 + 40 + 20);
        // the Bedrock slice windows follow the same lengths
        let hud = serde_json::to_string(&Value::Object(generate_hud_screen_json("ns", &els))).unwrap();
        assert!(hud.contains(&format!("(('%.{}s' * #kz_s) - ('%.{}s' * #kz_s))", bars + 7, bars)));
        assert!(hud.contains(&format!("(('%.{}s' * #kz_s) - ('%.{}s' * #kz_s))", bars + 47, bars + 7)));
    }

    /// Editor anchors middle_left / middle_right are written with Bedrock's names.
    #[test]
    fn side_anchors_use_bedrock_names() {
        let els: Vec<Value> = vec![
            json!({ "id": 1, "type": "image", "name": "l", "texturePath": "textures/ns/l", "size": [10, 10], "offset": [4, 0],
                    "anchor_from": "middle_left", "anchor_to": "middle_left", "layer": 100 }),
            json!({ "id": 2, "type": "image", "name": "r", "texturePath": "textures/ns/r", "size": [10, 10], "offset": [-4, 0],
                    "anchor_from": "middle_right", "anchor_to": "middle_right", "layer": 100 }),
            json!({ "id": 3, "type": "text", "name": "t", "collection_index": 0, "pad_length": 6, "papi_placeholder": "%x%",
                    "offset": [4, 0], "anchor_from": "middle_left", "anchor_to": "middle_left",
                    "text_anchor_from": "middle_right", "text_anchor_to": "middle_right" }),
        ];
        let text = serde_json::to_string(&Value::Object(generate_hud_screen_json("ns", &els))).unwrap();
        assert!(!text.contains("middle_left") && !text.contains("middle_right"), "editor anchor names leaked");
        assert!(text.contains("\"anchor_from\":\"left_middle\""));
        assert!(text.contains("\"anchor_from\":\"right_middle\""));
        assert!(text.contains("\"anchor_to\":\"right_middle\""));
    }

    /// The XP level number sits in a panel of the element's size (placed by the element's anchor and
    /// offset) and the label is centred in it, lifted like the other centred labels.
    #[test]
    fn xp_level_is_centred_in_its_box() {
        let els: Vec<Value> = vec![json!({ "id": 9, "type": "xp_label", "name": "xp_level", "xp_font_size": "normal",
            "xp_color": [0.5, 1, 0.13], "xp_shadow": true, "anchor_from": "bottom_middle", "anchor_to": "bottom_middle",
            "offset": [-187.5, -11], "size": [20, 10], "layer": 106 })];
        let hud = Value::Object(generate_hud_screen_json("ns", &els));
        fn find<'a>(v: &'a Value, key: &str) -> Option<&'a Value> {
            match v {
                Value::Object(o) => o.get(key).or_else(|| o.values().find_map(|x| find(x, key))),
                Value::Array(a) => a.iter().find_map(|x| find(x, key)),
                _ => None,
            }
        }
        let ctrl = find(&hud, "xp_level").expect("xp_level control");
        assert_eq!(ctrl["type"], "panel");
        assert_eq!(ctrl["anchor_from"], "bottom_middle");
        assert_eq!(ctrl["offset"], json!([-187.5, -11]));
        assert_eq!(ctrl["size"], json!([12, 9]), "the old 20×10 default is read as the 12×9 template box");
        assert_eq!(xp_box_size(&json!({ "size": [16, 12] })), json!([16, 12]));
        assert_eq!(xp_box_size(&json!({})), json!([12, 9]));
        let label = &ctrl["controls"][0]["label"];
        assert_eq!(label["type"], "label");
        assert_eq!(label["text"], "#level_number");
        assert_eq!(label["anchor_from"], "center");
        assert_eq!(label["anchor_to"], "center");
        assert_eq!(label["offset"], json!([0, 0]));
        assert_eq!(label["font_size"], "normal");
        assert_eq!(label["font_type"], "smooth");
        assert_eq!(label["layer"], 106);
    }

    /// Slot labels honour text_offset relative to its default (same rule as the Java export).
    #[test]
    fn slot_label_offset_is_text_offset_minus_default() {
        let top_small = json!({ "font_size": "small", "text_anchor_from": "top_left", "text_offset": [0, -2.8] });
        assert_eq!(text_offset_delta(&top_small, "small", "top_left"), json!([0, 0]));
        // middle row: default offset + Bedrock font correction (small −1, normal/large 0)
        let middle_small = json!({ "text_offset": [0, 0.9] });
        assert_eq!(text_offset_delta(&middle_small, "small", "center"), json!([0, -1]));
        let middle_normal = json!({ "text_offset": [0, 1.4] });
        assert_eq!(text_offset_delta(&middle_normal, "normal", "center"), json!([0, 0]));
        assert_eq!(text_offset_delta(&json!({ "text_offset": [0, 2] }), "large", "center"), json!([0, 0]));
        assert_eq!(text_offset_delta(&json!({}), "small", "center"), json!([0, -1]), "no text_offset, middle");
        assert_eq!(text_offset_delta(&json!({}), "small", "top_left"), json!([0, 0]), "no text_offset");
        let moved = json!({ "text_offset": [1, -1.8] });
        assert_eq!(text_offset_delta(&moved, "small", "top_left"), json!([1, 1]));

        let mut els = sample();
        els[2]["font_size"] = json!("small");
        els[2]["text_anchor_from"] = json!("top_left");
        els[2]["text_offset"] = json!([1, -1.8]);
        let hud = Value::Object(generate_hud_screen_json("ns", &els));
        let label = &hud["custom_bossbars_panel"]["controls"][0]["slot_1"]["controls"][0]["label"];
        assert_eq!(label["offset"], json!([1, 1]));
    }

    /// The HUD must not depend on our bossbar being the first one on the client.
    #[test]
    fn hud_reads_its_own_bossbar_in_any_order() {
        let els = sample();
        let hud = Value::Object(generate_hud_screen_json("ns", &els));
        let text = serde_json::to_string(&hud).unwrap();
        assert!(!text.contains("\"source_control_name\":\"custom_bossbars_panel\""), "labels must not read the first bossbar panel");
        let f = &hud["ns_factory"];
        assert_eq!(f["type"], "grid");
        assert_eq!(f["grid_item_template"], "hud.ns_panel");
        assert_eq!(f["grid_dimensions"], json!([1, 1]));
        assert_eq!(f["collection_name"], "boss_bars");
        assert!(f.get("bindings").is_none(), "no #form_button_length on the HUD");
        assert_eq!(hud["custom_bossbars_factory"]["grid_item_template"], "hud.custom_bossbars_panel");
        let front = &hud["root_panel"]["modifications"][0];
        assert_eq!(front["operation"], "insert_front");
        assert!(front["value"].is_object(), "insert_front value must be an object");
        assert!(front["value"].get("ns_factory@hud.ns_factory").is_some());
        // level 1 must not match kh10..kh16
        let hp1 = serde_json::to_string(&hud["ns_panel"]["controls"]).unwrap();
        assert!(hp1.contains("kh1&") && hp1.contains("kh1@"));
        assert!(!hp1.contains("'kh1') = #bossName"));
        let boss = serde_json::to_string(&hud["custom_bossbars_panel"]["bindings"]).unwrap();
        assert!(boss.contains("(not ((#bossName - '@zelisce/custom_bossbars') = #bossName))"));
        assert!(boss.contains("#left_string_1"));
        let dev = generate_split_files("ns", &els);
        assert_eq!(dev["ui/_ui_defs.json"]["ui_defs"], json!([]));
        // strict prefix check on the panel
        let binds = serde_json::to_string(&hud["ns_panel"]["bindings"]).unwrap();
        assert!(binds.contains("@zelisce/custom_bossbars"));
    }

    fn png_data_url(w: u32, h: u32, rgba: [u8; 4]) -> String {
        use base64::Engine;
        let img = image::RgbaImage::from_pixel(w, h, image::Rgba(rgba));
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgba8(img).write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png).unwrap();
        format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(buf))
    }

    #[test]
    fn animated_image_uses_flip_book() {
        let f = |c: u8| png_data_url(6, 4, [c, 0, 0, 255]);
        let els = vec![json!({ "id": 1, "type": "image", "name": "torch", "texturePath": "textures/ns/torch",
            "size": [12, 8], "offset": [0, 0], "anchor_from": "top_left", "anchor_to": "top_left",
            "imageData": f(10), "animFrames": [f(10), f(20), f(30)], "animFps": 5 })];
        let hud = generate_hud_screen_json("ns", &els);
        let anim = &hud["kz_anim_1_torch"];
        assert_eq!(anim["anim_type"], "flip_book");
        assert_eq!(anim["frame_count"], 3);
        assert_eq!(anim["frame_step"], 6);
        assert_eq!(anim["fps"], 5);
        let ctrl = &hud["ns_panel"]["controls"][0]["torch"];
        assert_eq!(ctrl["uv"], "@hud.kz_anim_1_torch");
        assert_eq!(ctrl["uv_size"], json!([6, 4]));
        assert_eq!(ctrl["size"], json!([12, 8]));
        // readable pack keeps the definition in hud_screen.json
        let files = generate_split_files("ns", &els);
        assert_eq!(files["ui/hud_screen.json"]["kz_anim_1_torch"]["frame_count"], 3);
        // a single frame is a still image
        let still = vec![json!({ "id": 1, "type": "image", "name": "t", "texturePath": "textures/ns/t", "size": [6, 4],
            "offset": [0, 0], "imageData": f(1), "animFrames": [f(1)] })];
        let hud = generate_hud_screen_json("ns", &still);
        assert!(hud["ns_panel"]["controls"][0]["t"].get("uv").is_none());
        assert!(!hud.keys().any(|k| k.starts_with("kz_anim")));
    }

    #[test]
    fn same_condition_shares_one_short_marker() {
        let img = |id: u32, papi: &str, value: &str| json!({ "id": id, "type": "image", "name": format!("i{}", id),
            "texturePath": format!("textures/ns/i{}", id), "size": [4, 4], "offset": [0, 0],
            "visibilityEnabled": true, "visibilityPapi": papi, "visibilityOperator": "==", "visibilityValue": value });
        let mut els: Vec<Value> = (1..=12).map(|i| img(i, "%player_gamemode%", "SURVIVAL")).collect();
        els.push(img(13, "%player_direction%", "S"));
        els.push(json!({ "id": 14, "type": "image", "name": "plain", "texturePath": "textures/ns/p", "size": [4, 4], "offset": [0, 0] }));
        let yml = generate_kaizer_multibar_config_yml(&els);
        let section = &yml[yml.find("visibility-conditions:").unwrap()..];
        assert_eq!(section.matches("    papi:").count(), 2);
        assert!(section.contains("  v01:") && section.contains("  v02:"));
        let hud = serde_json::to_string(&generate_hud_screen_json("ns", &els)).unwrap();
        assert_eq!(hud.matches("#bossName - '@v01'").count(), 12);
        assert_eq!(hud.matches("#bossName - '@v02'").count(), 1);
        assert!(!hud.contains("vib_"));
    }

    #[test]
    fn several_conditions_all_must_hold() {
        // Fantasy HUD armour icon: wearing a helmet, and it is not diamond / gold
        let img = |id: u32, extra: Value| json!({ "id": id, "type": "image", "name": format!("i{}", id),
            "texturePath": format!("textures/ns/i{}", id), "size": [4, 4], "offset": [0, 0],
            "visibilityEnabled": true, "visibilityPapi": "%armor_has_helmet%", "visibilityOperator": "==", "visibilityValue": "true",
            "visibilityExtra": extra });
        let els = vec![
            img(1, json!([{ "papi": "%armor_material_helmet%", "op": "!=", "value": "DIAMOND_HELMET" },
                          { "papi": "%armor_material_helmet%", "op": "!=", "value": "GOLDEN_HELMET" }])),
            // the diamond icon reuses the same marker, present instead of absent
            img(2, json!([{ "papi": "%armor_material_helmet%", "op": "==", "value": "DIAMOND_HELMET" },
                          { "papi": "", "op": "==", "value": "ignored" }])),
        ];
        let yml = generate_kaizer_multibar_config_yml(&els);
        let section = &yml[yml.find("visibility-conditions:").unwrap()..];
        assert_eq!(section.matches("    papi:").count(), 3);
        assert!(!section.contains("\"!=\""));
        assert!(!section.contains("invert: true"));
        let hud = generate_hud_screen_json("ns", &els);
        let test = |n: &str| hud["ns_panel"]["controls"].as_array().unwrap().iter()
            .find_map(|c| c.get(n)).unwrap()["bindings"][1]["source_property_name"].as_str().unwrap().to_string();
        assert_eq!(test("i1"), "((not ((#bossName - '@') = #bossName)) and (((not ((#bossName - '@v01') = #bossName)) and ((#bossName - '@v02') = #bossName)) and ((#bossName - '@v03') = #bossName)))");
        assert_eq!(test("i2"), "((not ((#bossName - '@') = #bossName)) and ((not ((#bossName - '@v01') = #bossName)) and (not ((#bossName - '@v02') = #bossName))))");
        // one condition, inverted: the same marker, must be absent
        let one = vec![json!({ "id": 1, "type": "image", "name": "a", "texturePath": "textures/ns/a", "size": [4, 4], "offset": [0, 0],
            "visibilityPapi": "%x%", "visibilityOperator": "==", "visibilityValue": "1", "visibilityInvert": true })];
        let hud = serde_json::to_string(&generate_hud_screen_json("ns", &one)).unwrap();
        assert!(hud.contains("and ((#bossName - '@v01') = #bossName))"));
    }
}

#[cfg(test)]
mod channel_tests {
    use super::*;

    fn sample() -> Vec<Value> {
        serde_json::from_value(json!([
            { "id": 1, "type": "image", "name": "bg", "texturePath": "textures/ns/bg", "size": [10, 10], "offset": [0, 0],
              "anchor_from": "top_left", "anchor_to": "top_left", "layer": 100,
              "visibilityEnabled": true, "visibilityPapi": "%player_gamemode%", "visibilityOperator": "==", "visibilityValue": "SURVIVAL" },
            { "id": 2, "type": "bar", "name": "hp", "barType": "hp", "barTexturePath": "textures/hotbar/fill_kh/horizontal/16",
              "barMaxSize": [40, 5], "size": [40, 5], "offset": [0, 0], "anchor_from": "top_left", "anchor_to": "top_left", "layer": 101 },
            { "id": 3, "type": "text", "name": "t", "collection_index": 0, "pad_auto": false, "pad_length": 30, "papi_placeholder": "%player_name%",
              "offset": [5, 5], "anchor_from": "top_left", "anchor_to": "top_left" },
            { "id": 4, "type": "nameplate", "name": "np", "collection_index": 0, "pad_auto": false, "pad_length": 30, "papi_placeholder": "%x%" },
            { "id": 5, "type": "xp_label", "name": "lvl", "size": [12, 9], "offset": [0, 0], "anchor_from": "bottom_middle", "anchor_to": "bottom_middle" }
        ]))
        .unwrap()
    }

    fn opts(c: HudChannel) -> HudOptions {
        HudOptions { channel: c, ..HudOptions::default() }
    }

    fn all_text(files: &Files) -> String {
        files.values().map(|v| serde_json::to_string(v).unwrap()).collect::<Vec<_>>().join("\n")
    }

    /// every `x@ns.ctrl` reference must point at a control that exists
    fn refs_resolve(files: &Files) {
        let mut defs: HashSet<String> = HashSet::new();
        for v in files.values() {
            let ns = js_string(get(v, "namespace"));
            if let Value::Object(o) = v {
                for k in o.keys() {
                    defs.insert(format!("{}.{}", ns, k.split('@').next().unwrap()));
                }
            }
        }
        let text = all_text(files);
        let mut i = 0;
        while let Some(p) = text[i..].find("kz_hud_instance@") {
            let start = i + p + "kz_hud_instance@".len();
            let end = start + text[start..].find('"').unwrap();
            let target = &text[start..end];
            assert!(defs.contains(target), "instance template {} not defined", target);
            i = end;
        }
    }

    #[test]
    fn bossbar_is_unchanged() {
        let els = sample();
        let a = generate_split_files_patched_with("ns", &els, None, &HudOptions::default());
        let t = all_text(&a);
        assert!(t.contains("boss_bars") && !t.contains(KZ_STORE));
        assert_eq!(
            generate_kaizer_multibar_config_yml(&els),
            generate_kaizer_multibar_config_yml_with(&els, HudChannel::Bossbar)
        );
        assert!(!generate_kaizer_multibar_config_yml(&els).contains("channel:"));
    }

    #[test]
    fn channels_read_from_the_store() {
        let els = sample();
        for ch in [HudChannel::Title] {
            let files = generate_split_files_patched_with("ns", &els, None, &opts(ch));
            let t = all_text(&files);
            assert!(!t.contains("boss_bars"), "{:?} still reads boss bars", ch);
            assert!(t.contains("source_control_name\":\"kz_hud_store\""));
            // every expression is kept: marker tests, level tests, slices
            assert!(t.contains("@v01"), "visibility marker test kept");
            assert!(t.contains("'%.") , "slice expressions kept");
            let screen = &files["ui/hud_screen.json"];
            for k in ["boss_health_panel", "boss_name_panel", "progress_bar"] {
                assert!(screen.get(k).is_none(), "{} must be dropped", k);
            }
            assert!(screen.get(KZ_STORE).is_some());
            let mods = serde_json::to_string(&screen["root_panel"]["modifications"]).unwrap();
            assert!(mods.contains("kz_hud_store@hud.kz_hud_store"));
            assert!(screen.get("hud_title_text").is_some());
            assert!(serde_json::to_string(&screen[KZ_STORE]).unwrap().contains("#hud_title_text_string"));
            assert!(!t.contains("actionbar"), "no action bar parts any more");
            refs_resolve(&files);
            let yml = generate_kaizer_multibar_config_yml_with(&els, ch);
            assert!(yml.contains(&format!("  channel: {}", ch.config_name())));
        }
    }

    /// bars: no condition → plain level test; with a condition → level test AND the marker test
    #[test]
    fn bar_visibility_expressions() {
        let bar = |extra: Value| {
            let mut b = json!({ "id": 9, "type": "bar", "name": "hp", "barType": "hp", "barTexturePath": "t/kh",
                "barMaxSize": [40, 5], "size": [40, 5], "offset": [0, 0], "anchor_from": "top_left", "anchor_to": "top_left" });
            for (k, v) in extra.as_object().unwrap() { b[k] = v.clone(); }
            b
        };
        let plain = vec![bar(json!({}))];
        let hud = generate_hud_screen_json("ns", &plain);
        let t = serde_json::to_string(&hud["ns_panel"]).unwrap();
        assert!(!t.contains("@v0"), "a bar without a condition must not need a marker");
        assert!(generate_kaizer_multibar_config_yml(&plain).find("visibility-conditions").is_none());
        let cond = vec![bar(json!({ "visibilityPapi": "%player_gamemode%", "visibilityOperator": "==", "visibilityValue": "SURVIVAL" }))];
        let hud = generate_hud_screen_json("ns", &cond);
        let v = &hud["ns_panel"]["controls"][15]["hp_16"]["bindings"][1]["source_property_name"];
        assert_eq!(v, &json!("(((not ((#bossName - 'kh16') = #bossName))) and (not ((#bossName - '@v01') = #bossName)))"));
    }

    #[test]
    fn debug_overlay_keeps_vanilla_visible() {
        let els = sample();
        for ch in [HudChannel::Title] {
            let o = HudOptions { channel: ch, channel_debug: true, ..HudOptions::default() };
            let files = generate_split_files_patched_with("ns", &els, None, &o);
            let screen = &files["ui/hud_screen.json"];
            assert!(screen.get("kz_channel_debug").is_some());
            let t = serde_json::to_string(screen).unwrap();
            assert!(t.contains("kz_channel_debug@hud.kz_channel_debug"));
            assert!(screen.get("hud_title_text").is_none());
        }
        assert!(HudOptions::from_data(&json!({ "hudChannelDebug": true })).channel_debug);
    }

    #[test]
    fn channel_from_project_data() {
        assert_eq!(HudOptions::from_data(&json!({})).channel, HudChannel::Bossbar);
        // removed channel: old projects fall back to the boss bar
        assert_eq!(HudOptions::from_data(&json!({ "hudChannel": "actionbar" })).channel, HudChannel::Bossbar);
        assert_eq!(HudOptions::from_data(&json!({ "hudChannel": "title" })).channel, HudChannel::Title);
        assert_eq!(HudOptions::from_data(&json!({ "hudChannel": "???" })).channel, HudChannel::Bossbar);
    }
}
