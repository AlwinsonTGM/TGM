// Disposable feasibility bridge. Never ship this unauthenticated listener.
use crate::{db, InnerState};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::{io::{Read, Write}, net::{TcpListener, TcpStream}, sync::{Arc, Mutex}, thread, time::Duration};

pub fn start(state: Arc<Mutex<InnerState>>) {
    let safe_root = match std::env::var("FLOWSTATE_PROOF_DATA_ROOT") {
        Ok(path) => std::path::PathBuf::from(path),
        Err(_) => return,
    };
    assert!(db::get_db_path().starts_with(&safe_root), "refusing to use non-proof FlowState data");
    let listener = TcpListener::bind("127.0.0.1:42731").expect("proof port unavailable");
    thread::spawn(move || for stream in listener.incoming().flatten() {
        handle(stream, &state);
    });
}

fn handle(mut stream: TcpStream, state: &Arc<Mutex<InnerState>>) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let mut bytes = Vec::new();
    let mut buf = [0; 2048];
    loop {
        match stream.read(&mut buf) {
            Ok(0) | Err(_) => return,
            Ok(n) => bytes.extend_from_slice(&buf[..n]),
        }
        if bytes.len() > 16384 { return; }
        if let Some(end) = bytes.windows(4).position(|x| x == b"\r\n\r\n") {
            let headers = String::from_utf8_lossy(&bytes[..end]);
            let length = headers.lines().find_map(|line| {
                let (key, val) = line.split_once(':')?;
                if key.eq_ignore_ascii_case("content-length") { val.trim().parse::<usize>().ok() } else { None }
            }).unwrap_or(0);
            if bytes.len() >= end + 4 + length { break; }
        }
    }
    let end = bytes.windows(4).position(|x| x == b"\r\n\r\n").unwrap();
    let headers = String::from_utf8_lossy(&bytes[..end]);
    let mut parts = headers.lines().next().unwrap_or("").split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");
    let body: Value = serde_json::from_slice(&bytes[end + 4..]).unwrap_or(json!({}));
    let result = action(method, path, body, state);
    let payload = match result { Ok(v) => v, Err(e) => json!({"ok": false, "error": e}) }.to_string();
    let response = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", payload.len(), payload);
    let _ = stream.write_all(response.as_bytes());
}

fn action(method: &str, path: &str, body: Value, state: &Arc<Mutex<InnerState>>) -> Result<Value, String> {
    let mut inner = state.lock().map_err(|e| e.to_string())?;
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    match (method, path) {
        ("POST", "/start") => {
            if inner.active_task.is_some() { return Err("a session is already active".into()); }
            let title = body.get("title").and_then(Value::as_str).filter(|s| !s.trim().is_empty() && s.len() <= 200).ok_or("title required")?;
            let secs = body.get("estimated_seconds").and_then(Value::as_i64).unwrap_or(1500).clamp(1, 86400) as i32;
            let task = db::create_task(&conn, title, secs).map_err(|e| e.to_string())?;
            inner.active_task = Some(task.clone());
            inner.context_switches = 0;
            inner.is_paused = false;
            inner.last_app.clear();
            Ok(json!({"ok": true, "task": task}))
        }
        ("POST", "/stop") => {
            let task = inner.active_task.as_ref().ok_or("no active session")?.clone();
            conn.execute_batch("SAVEPOINT proof_stop").map_err(|e| e.to_string())?;
            let result = (|| -> Result<_, String> {
                let session = db::finish_focus_session(&conn, task.id, None).map_err(|e| e.to_string())?.ok_or("task missing")?;
                conn.execute("UPDATE tasks SET status='pending', completed_at=NULL WHERE id=?1", [task.id]).map_err(|e| e.to_string())?;
                Ok(session)
            })();
            let session = match result {
                Ok(session) => { conn.execute_batch("RELEASE proof_stop").map_err(|e| e.to_string())?; session }
                Err(e) => { let _ = conn.execute_batch("ROLLBACK TO proof_stop; RELEASE proof_stop"); return Err(e); }
            };
            inner.active_task = None;
            inner.context_switches = 0;
            inner.is_paused = false;
            Ok(json!({"ok": true, "session": session, "task_status": "pending"}))
        }
        ("GET", "/status") => {
            let sessions = db::get_completed_sessions(&conn, 1).map_err(|e| e.to_string())?;
            Ok(json!({"ok": true, "active_task": inner.active_task, "last_session": sessions.first()}))
        }
        _ => Err("unknown request".into()),
    }
}
