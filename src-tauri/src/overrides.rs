//! User code overrides on top of the generated JSON.
//!
//! The generated code is always the base. A user edit is stored as a patch
//! (the difference between the generated JSON and the edited JSON) and is
//! re-applied every time the code is generated again, so elements can keep
//! moving while hand edits survive.
//!
//! Patch format (an extension of JSON Merge Patch, RFC 7386):
//! * object  → merged key by key, `null` deletes a key
//! * `{"$kz":"keyed","items":{name: patch|null}}` → a JSON UI control list
//!   (`[{"name": {...}}, …]`) patched by control name; unknown names are appended
//! * `{"$kz":"index","items":{"3": patch}}` → array patched by position
//! * `{"$kz":"replace","value": …}` → value replaced as a whole
//! * anything else → value replaced
//!
//! The patches are produced by `makeOverridePatch` in ui/js/codeview.js.

use serde_json::{Map, Value};

const MARK: &str = "$kz";

fn single_key(v: &Value) -> Option<&str> {
    match v {
        Value::Object(o) if o.len() == 1 => o.keys().next().map(|s| s.as_str()),
        _ => None,
    }
}

pub fn apply(target: &mut Value, patch: &Value) {
    if let Value::Object(p) = patch {
        match p.get(MARK).and_then(|m| m.as_str()) {
            Some("replace") => {
                *target = p.get("value").cloned().unwrap_or(Value::Null);
                return;
            }
            Some("keyed") => {
                if !target.is_array() {
                    *target = Value::Array(vec![]);
                }
                let arr = target.as_array_mut().unwrap();
                if let Some(Value::Object(items)) = p.get("items") {
                    for (name, item_patch) in items {
                        let pos = arr.iter().position(|it| single_key(it) == Some(name.as_str()));
                        match (pos, item_patch.is_null()) {
                            (Some(i), true) => {
                                arr.remove(i);
                            }
                            (Some(i), false) => {
                                if let Some(inner) = arr[i].get_mut(name.as_str()) {
                                    apply(inner, item_patch);
                                }
                            }
                            (None, false) => {
                                let mut inner = Value::Null;
                                apply(&mut inner, item_patch);
                                let mut wrapper = Map::new();
                                wrapper.insert(name.clone(), inner);
                                arr.push(Value::Object(wrapper));
                            }
                            (None, true) => {}
                        }
                    }
                }
                return;
            }
            Some("index") => {
                if let (Value::Array(arr), Some(Value::Object(items))) = (&mut *target, p.get("items")) {
                    for (idx, item_patch) in items {
                        if let Ok(i) = idx.parse::<usize>() {
                            if i < arr.len() {
                                apply(&mut arr[i], item_patch);
                            }
                        }
                    }
                }
                return;
            }
            _ => {}
        }
        if !target.is_object() {
            *target = Value::Object(Map::new());
        }
        let t = target.as_object_mut().unwrap();
        for (k, v) in p {
            if v.is_null() {
                t.shift_remove(k);
            } else {
                apply(t.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
    } else {
        *target = patch.clone();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn merges_objects_and_keyed_controls() {
        let mut base = json!({
            "panel": {
                "size": [100, 100],
                "controls": [
                    { "a": { "alpha": 1, "layer": 1 } },
                    { "b": { "alpha": 1 } }
                ]
            },
            "gone": 1
        });
        let patch = json!({
            "gone": null,
            "panel": {
                "size": { "$kz": "index", "items": { "1": 50 } },
                "controls": { "$kz": "keyed", "items": {
                    "a": { "alpha": 0.4 },
                    "b": null,
                    "c": { "type": "image", "size": [1, 2] }
                }}
            }
        });
        apply(&mut base, &patch);
        assert_eq!(
            base,
            json!({
                "panel": {
                    "size": [100, 50],
                    "controls": [
                        { "a": { "alpha": 0.4, "layer": 1 } },
                        { "c": { "type": "image", "size": [1, 2] } }
                    ]
                }
            })
        );
    }

    #[test]
    fn keyed_patch_survives_new_generated_controls() {
        // user tweaked "a"; later the generator added "z" — both must be present
        let mut regenerated = json!({ "controls": [ { "a": { "alpha": 1 } }, { "z": { "alpha": 1 } } ] });
        let patch = json!({ "controls": { "$kz": "keyed", "items": { "a": { "alpha": 0.5 } } } });
        apply(&mut regenerated, &patch);
        assert_eq!(regenerated, json!({ "controls": [ { "a": { "alpha": 0.5 } }, { "z": { "alpha": 1 } } ] }));
    }

    /// Patch produced by the UI's makeOverridePatch (KZ_XCHECK_DIR) must turn the
    /// generated HUD into exactly the edited HUD.
    #[test]
    fn js_patch_cross_check() {
        let Ok(dir) = std::env::var("KZ_XCHECK_DIR") else { return };
        let read = |f: &str| -> Value {
            serde_json::from_str(&std::fs::read_to_string(std::path::Path::new(&dir).join(f)).unwrap()).unwrap()
        };
        let mut generated = read("rust_out/fixture_full/dev_hud_screen.json");
        apply(&mut generated, &read("xcheck_patch.json"));
        assert_eq!(generated, read("xcheck_expected.json"));
    }

    #[test]
    fn replace_marker() {
        let mut v = json!({ "x": [1, 2, 3] });
        apply(&mut v, &json!({ "x": { "$kz": "replace", "value": [9] } }));
        assert_eq!(v, json!({ "x": [9] }));
    }
}
