//! Local project storage (replaces the MongoDB + /api/projects routes).
//! Each project is one JSON file in `<app data>/projects/<id>.json`.

use rand::Rng;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

pub struct Storage {
    dir: PathBuf,
}

/// Same rules as the server's `sanitizeFolderName`.
pub fn sanitize_name(name: &str) -> String {
    let replaced: String = name
        .trim()
        .chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect();
    let trimmed = replaced.trim_end_matches('.');
    let mut collapsed = String::new();
    let mut prev_ws = false;
    for c in trimmed.chars() {
        if c.is_whitespace() {
            if !prev_ws {
                collapsed.push(' ');
            }
            prev_ws = true;
        } else {
            collapsed.push(c);
            prev_ws = false;
        }
    }
    let units: Vec<u16> = collapsed.encode_utf16().take(100).collect();
    let limited = String::from_utf16_lossy(&units);
    if limited.is_empty() {
        "untitled".into()
    } else {
        limited
    }
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// 24 hex chars, like a MongoDB ObjectId (timestamp + random).
fn new_id() -> String {
    let ts = chrono::Utc::now().timestamp() as u32;
    let mut rng = rand::thread_rng();
    let r: [u8; 8] = rng.gen();
    let mut s = format!("{:08x}", ts);
    for b in r {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric())
}

impl Storage {
    pub fn new(dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(Self { dir })
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    fn path(&self, id: &str) -> Result<PathBuf, String> {
        if !valid_id(id) {
            return Err("Project not found".into());
        }
        Ok(self.dir.join(format!("{}.json", id)))
    }

    fn read(&self, id: &str) -> Result<Value, String> {
        let p = self.path(id)?;
        let text = fs::read_to_string(&p).map_err(|_| "Project not found".to_string())?;
        serde_json::from_str(&text).map_err(|e| format!("Project file is corrupted: {}", e))
    }

    fn write(&self, id: &str, project: &Value) -> Result<(), String> {
        let p = self.path(id)?;
        let tmp = p.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_vec(project).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &p).map_err(|e| e.to_string())
    }

    pub fn list(&self) -> Result<Vec<Value>, String> {
        let mut out = vec![];
        for entry in fs::read_dir(&self.dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let Ok(text) = fs::read_to_string(&path) else { continue };
            let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
            out.push(json!({
                "_id": v.get("_id").cloned().unwrap_or(Value::Null),
                "name": v.get("name").cloned().unwrap_or(Value::Null),
                "updatedAt": v.get("updatedAt").cloned().unwrap_or(Value::Null),
                "createdAt": v.get("createdAt").cloned().unwrap_or(Value::Null),
            }));
        }
        out.sort_by(|a, b| {
            let ka = a.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
            let kb = b.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
            kb.cmp(ka)
        });
        Ok(out)
    }

    pub fn get(&self, id: &str) -> Result<Value, String> {
        self.read(id)
    }

    pub fn create(&self, name: &str, data: Value) -> Result<Value, String> {
        let id = new_id();
        let now = now_iso();
        let project = json!({
            "_id": id,
            "name": sanitize_name(name),
            "data": data,
            "createdAt": now,
            "updatedAt": now,
        });
        self.write(&id, &project)?;
        Ok(json!({ "projectId": id, "message": "Project saved successfully" }))
    }

    pub fn update(&self, id: &str, name: Option<&str>, data: Value) -> Result<Value, String> {
        let mut project = self.read(id)?;
        let old_name = project.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let new_name = match name {
            Some(n) if !n.is_empty() => sanitize_name(n),
            _ => sanitize_name(&old_name),
        };
        let obj = project.as_object_mut().ok_or("Project file is corrupted")?;
        obj.insert("name".into(), json!(new_name));
        obj.insert("data".into(), data);
        obj.insert("updatedAt".into(), json!(now_iso()));
        self.write(id, &project)?;
        Ok(json!({ "message": "Project updated successfully" }))
    }

    pub fn delete(&self, id: &str) -> Result<Value, String> {
        let p = self.path(id)?;
        if !p.exists() {
            return Err("Project not found".into());
        }
        fs::remove_file(&p).map_err(|e| e.to_string())?;
        Ok(json!({ "message": "Project deleted successfully" }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_matches_server() {
        assert_eq!(sanitize_name("  my:proj?  "), "my_proj_");
        assert_eq!(sanitize_name("a   b"), "a b");
        assert_eq!(sanitize_name("name..."), "name");
        assert_eq!(sanitize_name(""), "untitled");
    }
}
