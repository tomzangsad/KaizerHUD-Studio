//! Localhost HTTP JSON-RPC bridge between `mcp-server/index.mjs` and the running
//! Tauri WebView window (HUD Studio or GUI Studio), plus Rust codegen fast-paths.

use rand::Rng;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

const MAX_BODY_BYTES: usize = 32 * 1024 * 1024;
const RECENT_LIMIT: usize = 25;

pub struct McpBridgeState {
    pub port: u16,
    pub token: String,
    pub bridge_file: PathBuf,
    active_workspace: Mutex<String>,
    pending: Mutex<HashMap<String, mpsc::Sender<Result<Value, String>>>>,
    recent_actions: Mutex<Vec<Value>>,
}

impl McpBridgeState {
    fn new(port: u16, token: String, bridge_file: PathBuf) -> Self {
        Self {
            port,
            token,
            bridge_file,
            active_workspace: Mutex::new("hud".into()),
            pending: Mutex::new(HashMap::new()),
            recent_actions: Mutex::new(Vec::new()),
        }
    }

    pub fn workspace(&self) -> String {
        self.active_workspace
            .lock()
            .map(|g| g.clone())
            .unwrap_or_else(|_| "hud".into())
    }

    pub fn record_action(&self, method: &str, ok: bool, summary: &str) {
        if let Ok(mut list) = self.recent_actions.lock() {
            list.insert(
                0,
                json!({
                    "method": method,
                    "ok": ok,
                    "summary": summary,
                    "at": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
                }),
            );
            if list.len() > RECENT_LIMIT {
                list.truncate(RECENT_LIMIT);
            }
        }
    }

    pub fn cleanup_bridge(&self) {
        let _ = fs::remove_file(&self.bridge_file);
    }
}

fn random_hex_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: [u8; 16] = rng.gen();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn write_bridge_file(path: &Path, port: u16, token: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let payload = json!({
        "port": port,
        "token": token,
        "pid": std::process::id(),
        "version": env!("CARGO_PKG_VERSION"),
        "startedAt": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    });
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(&payload).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

pub fn start_bridge(app: AppHandle, data_dir: PathBuf) -> Result<Arc<McpBridgeState>, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("MCP bridge bind failed: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let token = random_hex_token();
    let bridge_file = data_dir.join("mcp_bridge.json");
    write_bridge_file(&bridge_file, port, &token)?;

    let state = Arc::new(McpBridgeState::new(port, token, bridge_file));
    let bg_state = Arc::clone(&state);

    std::thread::Builder::new()
        .name("kaizer-mcp-bridge".into())
        .spawn(move || {
            for stream in listener.incoming() {
                let Ok(stream) = stream else { continue };
                let st = Arc::clone(&bg_state);
                let app_clone = app.clone();
                std::thread::spawn(move || {
                    let _ = handle_connection(stream, st, Some(app_clone));
                });
            }
        })
        .map_err(|e| format!("MCP bridge thread failed: {}", e))?;

    Ok(state)
}

fn send_json_response(stream: &mut TcpStream, status: &str, body: &Value) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(body).unwrap_or_else(|_| b"{}".to_vec());
    let head = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        status,
        bytes.len()
    );
    stream.write_all(head.as_bytes())?;
    stream.write_all(&bytes)?;
    stream.flush()
}

fn handle_connection(
    mut stream: TcpStream,
    state: Arc<McpBridgeState>,
    app: Option<AppHandle>,
) -> Result<(), String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));

    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let mut request_line = String::new();
    if reader.read_line(&mut request_line).map_err(|e| e.to_string())? == 0 {
        return Ok(());
    }
    let mut parts = request_line.trim_end().split_whitespace();
    let http_method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("/");

    let mut content_length: usize = 0;
    let mut auth_header = String::new();
    loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line).map_err(|e| e.to_string())?;
        if n == 0 || line == "\r\n" || line == "\n" {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_ascii_lowercase();
            let val = v.trim();
            if key == "content-length" {
                content_length = val.parse::<usize>().unwrap_or(0);
            } else if key == "authorization" {
                auth_header = val.to_string();
            }
        }
    }

    let expected = format!("Bearer {}", state.token);
    if auth_header != expected {
        let _ = send_json_response(
            &mut stream,
            "401 Unauthorized",
            &json!({ "ok": false, "error": "Unauthorized" }),
        );
        return Ok(());
    }

    if http_method == "GET" && path == "/health" {
        let _ = send_json_response(
            &mut stream,
            "200 OK",
            &json!({
                "ok": true,
                "pid": std::process::id(),
                "port": state.port,
                "workspace": state.workspace(),
                "version": env!("CARGO_PKG_VERSION"),
            }),
        );
        return Ok(());
    }

    if http_method != "POST" || path != "/rpc" {
        let _ = send_json_response(
            &mut stream,
            "404 Not Found",
            &json!({ "ok": false, "error": "Unknown route" }),
        );
        return Ok(());
    }

    if content_length > MAX_BODY_BYTES {
        let _ = send_json_response(
            &mut stream,
            "413 Payload Too Large",
            &json!({ "ok": false, "error": "Payload too large" }),
        );
        return Ok(());
    }

    let mut body_buf = vec![0u8; content_length];
    if content_length > 0 {
        reader.read_exact(&mut body_buf).map_err(|e| e.to_string())?;
    }
    let req: Value = match serde_json::from_slice(&body_buf) {
        Ok(v) => v,
        Err(e) => {
            let _ = send_json_response(
                &mut stream,
                "400 Bad Request",
                &json!({ "ok": false, "error": format!("Invalid JSON: {}", e) }),
            );
            return Ok(());
        }
    };

    let method = req.get("method").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let params = req.get("params").cloned().unwrap_or_else(|| json!({}));

    if method.is_empty() {
        let _ = send_json_response(
            &mut stream,
            "400 Bad Request",
            &json!({ "ok": false, "error": "Missing method" }),
        );
        return Ok(());
    }

    if let Some(res) = handle_rust_fastpath(&method, &params) {
        match res {
            Ok(val) => {
                state.record_action(&method, true, "Rust backend completed");
                let _ = send_json_response(&mut stream, "200 OK", &json!({ "ok": true, "result": val }));
            }
            Err(err) => {
                state.record_action(&method, false, &err);
                let _ = send_json_response(&mut stream, "200 OK", &json!({ "ok": false, "error": err }));
            }
        }
        return Ok(());
    }

    let Some(app_handle) = app else {
        let _ = send_json_response(
            &mut stream,
            "503 Service Unavailable",
            &json!({ "ok": false, "error": "WebView host unavailable" }),
        );
        return Ok(());
    };

    let req_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = mpsc::channel::<Result<Value, String>>();
    state.pending.lock().unwrap().insert(req_id.clone(), tx);

    let emit_res = app_handle.emit(
        "mcp:request",
        json!({
            "reqId": req_id,
            "method": method,
            "params": params,
        }),
    );

    if let Err(e) = emit_res {
        state.pending.lock().unwrap().remove(&req_id);
        let msg = format!("Could not emit mcp:request to WebView: {}", e);
        state.record_action(&method, false, &msg);
        let _ = send_json_response(&mut stream, "500 Internal Server Error", &json!({ "ok": false, "error": msg }));
        return Ok(());
    }

    let timeout = Duration::from_secs(25);
    match rx.recv_timeout(timeout) {
        Ok(Ok(val)) => {
            state.record_action(&method, true, "Live WebView applied");
            let _ = send_json_response(&mut stream, "200 OK", &json!({ "ok": true, "result": val }));
        }
        Ok(Err(err)) => {
            state.record_action(&method, false, &err);
            let _ = send_json_response(&mut stream, "200 OK", &json!({ "ok": false, "error": err }));
        }
        Err(_) => {
            state.pending.lock().unwrap().remove(&req_id);
            let msg = format!("Timed out waiting for live studio response ({})", method);
            state.record_action(&method, false, &msg);
            let _ = send_json_response(&mut stream, "504 Gateway Timeout", &json!({ "ok": false, "error": msg }));
        }
    }

    Ok(())
}

fn handle_rust_fastpath(method: &str, params: &Value) -> Option<Result<Value, String>> {
    match method {
        "rust.hud_preview_code" => {
            let data = params.get("data").cloned().unwrap_or_else(|| json!({}));
            Some(Ok(crate::export::preview(&data)))
        }
        "rust.hud_sync_folder" => {
            let data = params.get("data").cloned().unwrap_or_else(|| json!({}));
            let Some(folder) = params.get("folder").and_then(|v| v.as_str()) else {
                return Some(Err("Missing folder path".into()));
            };
            let force = params.get("force").and_then(|v| v.as_bool()).unwrap_or(false);
            let path = PathBuf::from(folder);
            if !force && !crate::export::folder_is_safe_to_sync(&path) {
                return Some(Err("FOLDER_NOT_EMPTY".into()));
            }
            Some(
                crate::export::sync_folder(&data, &path)
                    .map(|files| json!({ "files": files, "folder": folder })),
            )
        }
        "rust.hud_export_zip" => {
            let data = params.get("data").cloned().unwrap_or_else(|| json!({}));
            let Some(out_path) = params.get("outputPath").and_then(|v| v.as_str()) else {
                return Some(Err("Missing outputPath".into()));
            };
            let path = PathBuf::from(out_path);
            let Some(parent) = path.parent() else {
                return Some(Err("Invalid outputPath".into()));
            };
            if let Err(e) = fs::create_dir_all(parent) {
                return Some(Err(format!("Could not create directory: {}", e)));
            }
            let res = crate::export::build_export_zip_with(crate::export::ExportInput { data: &data }, Vec::new())
                .and_then(|bytes| {
                    let len = bytes.len();
                    fs::write(&path, bytes)
                        .map(|_| json!({ "outputPath": out_path, "bytes": len }))
                        .map_err(|e| format!("Could not write zip: {}", e))
                });
            Some(res)
        }
        _ => None,
    }
}

#[tauri::command]
pub fn mcp_bridge_hello(state: State<Arc<McpBridgeState>>, workspace: String) -> Result<Value, String> {
    let ws = match workspace.trim().to_ascii_lowercase().as_str() {
        "gui" => "gui".to_string(),
        _ => "hud".to_string(),
    };
    if let Ok(mut guard) = state.active_workspace.lock() {
        *guard = ws.clone();
    }
    Ok(json!({
        "port": state.port,
        "workspace": ws,
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

#[tauri::command]
pub fn mcp_bridge_reply(
    state: State<Arc<McpBridgeState>>,
    req_id: String,
    ok: bool,
    result: Option<Value>,
    error: Option<String>,
) -> Result<(), String> {
    let sender = state.pending.lock().unwrap().remove(&req_id);
    if let Some(tx) = sender {
        let msg = if ok {
            Ok(result.unwrap_or(Value::Null))
        } else {
            Err(error.unwrap_or_else(|| "Unknown live bridge error".into()))
        };
        let _ = tx.send(msg);
    }
    Ok(())
}

#[tauri::command]
pub fn mcp_bridge_info(state: State<Arc<McpBridgeState>>) -> Result<Value, String> {
    let recent = state
        .recent_actions
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default();
    Ok(json!({
        "port": state.port,
        "workspace": state.workspace(),
        "version": env!("CARGO_PKG_VERSION"),
        "bridgeFile": state.bridge_file.to_string_lossy(),
        "recentActions": recent,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_auth_health_and_cleanup() {
        let dir = std::env::temp_dir().join(format!("kz_mcp_bridge_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let bridge_file = dir.join("mcp_bridge.json");

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let token = "deadbeefcafebabe0123456789abcdef".to_string();
        write_bridge_file(&bridge_file, port, &token).unwrap();
        assert!(bridge_file.exists());

        let state = Arc::new(McpBridgeState::new(port, token.clone(), bridge_file.clone()));
        let st_bg = Arc::clone(&state);
        std::thread::spawn(move || {
            for stream in listener.incoming().take(3) {
                if let Ok(s) = stream {
                    let _ = handle_connection(s, Arc::clone(&st_bg), None);
                }
            }
        });

        // 1. Missing token -> 401
        let mut s1 = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s1.write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut r1 = String::new();
        s1.read_to_string(&mut r1).unwrap();
        assert!(r1.starts_with("HTTP/1.1 401 Unauthorized"), "got: {}", r1);

        // 2. Valid token -> 200 OK
        let mut s2 = TcpStream::connect(("127.0.0.1", port)).unwrap();
        let req2 = format!("GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {}\r\n\r\n", token);
        s2.write_all(req2.as_bytes()).unwrap();
        let mut r2 = String::new();
        s2.read_to_string(&mut r2).unwrap();
        assert!(r2.starts_with("HTTP/1.1 200 OK"), "got: {}", r2);
        assert!(r2.contains("\"workspace\":\"hud\""));

        // 3. Rust fast-path preview -> 200 OK
        let body = serde_json::json!({
            "method": "rust.hud_preview_code",
            "params": { "data": { "namespace": "mcp_test", "elements": [] } }
        })
        .to_string();
        let mut s3 = TcpStream::connect(("127.0.0.1", port)).unwrap();
        let req3 = format!(
            "POST /rpc HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {}\r\nContent-Length: {}\r\n\r\n{}",
            token,
            body.len(),
            body
        );
        s3.write_all(req3.as_bytes()).unwrap();
        let mut r3 = String::new();
        s3.read_to_string(&mut r3).unwrap();
        assert!(r3.contains("\"ok\":true"), "got: {}", r3);
        assert!(r3.contains("ui/hud_screen.json"), "got: {}", r3);

        state.cleanup_bridge();
        assert!(!bridge_file.exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
