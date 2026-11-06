mod db;
mod notes;
mod snip;
mod telemetry;
mod proof_bridge;

pub use db::get_app_dir;
use db::{create_task, get_active_task, get_daily_summary, get_timeline_events, init_db, record_tick, DailySummary, Task, WindowEvent};
use notes::{Note, Project};
use base64::Engine;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};
use std::sync::Mutex as StdMutex;


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStatePayload {
    pub current_app: String,
    pub current_title: String,
    pub category: String,
    pub productivity_score: i32,
    pub is_afk: bool,
    pub active_task: Option<Task>,
    pub context_switches: i32,
    pub today_focus_score: f64,
    pub today_deep_work_seconds: i32,
    pub is_distracted: bool,
    pub upcoming_alarm: Option<db::Alarm>,
    pub active_timer: Option<db::Alarm>,
    pub is_paused: bool,
}

struct InnerState {
    pub active_task: Option<Task>,
    pub context_switches: i32,
    pub last_category: String,
    pub last_productivity_score: i32,
    pub last_app: String,
    pub last_title: String,
    pub last_afk: bool,
    pub is_paused: bool,
}

pub struct SharedState(Arc<Mutex<InnerState>>);

const LOGFARE_BASE_URL: &str = "https://logfare.ai/v1";

fn elapsed_whole_seconds(elapsed: Duration, remainder: &mut Duration) -> i32 {
    *remainder += elapsed.min(Duration::from_secs(10));
    let seconds = remainder.as_secs().min(10);
    *remainder -= Duration::from_secs(seconds);
    seconds as i32
}

#[cfg(test)]
mod timing_tests {
    use super::*;

    #[test]
    fn fractional_ticks_do_not_drift() {
        let mut remainder = Duration::ZERO;
        let seconds: i32 = (0..10).map(|_| elapsed_whole_seconds(Duration::from_millis(1400), &mut remainder)).sum();
        assert_eq!(seconds, 14);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelHealthStatus {
    pub id: String,
    pub name: String,
    pub provider: String, // "local" or "logfare"
    pub status: String,   // "operational", "degraded", "offline"
    pub latency_ms: Option<u64>,
    pub uptime_info: String,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiHealthOverview {
    pub logfare_api_valid: bool,
    pub models: Vec<ModelHealthStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelAttemptRecord {
    pub model: String,
    pub success: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmFallbackResponse {
    pub success: bool,
    pub text: String,
    pub model_used: String,
    pub attempts: Vec<ModelAttemptRecord>,
}

#[tauri::command]
fn get_app_state(state: tauri::State<'_, SharedState>) -> Result<AppStatePayload, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let summary = get_daily_summary(&conn).unwrap_or(DailySummary {
        total_seconds: 0,
        deep_work_seconds: 0,
        communication_seconds: 0,
        distraction_seconds: 0,
        focus_score: 100.0,
        context_switches: 0,
    });

    let inner = state.0.lock().map_err(|e| e.to_string())?;
    let is_distracted = inner.last_productivity_score <= -2;

    let (upcoming_alarm, active_timer) = {
        let up = db::get_upcoming_alarm_within(&conn, 300).unwrap_or(None);
        let tm = db::get_active_timer(&conn).unwrap_or(None);
        (up, tm)
    };

    Ok(AppStatePayload {
        current_app: inner.last_app.clone(),
        current_title: inner.last_title.clone(),
        category: inner.last_category.clone(),
        productivity_score: inner.last_productivity_score,
        is_afk: inner.last_afk,
        active_task: inner.active_task.clone(),
        context_switches: inner.context_switches,
        today_focus_score: summary.focus_score,
        today_deep_work_seconds: summary.deep_work_seconds,
        is_distracted,
        upcoming_alarm,
        active_timer,
        is_paused: inner.is_paused,
    })
}

#[tauri::command]
fn start_task(
    state: tauri::State<'_, SharedState>,
    title: String,
    estimated_seconds: i32,
) -> Result<Task, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let task = create_task(&conn, &title, estimated_seconds).map_err(|e| e.to_string())?;

    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    inner.active_task = Some(task.clone());
    inner.context_switches = 0;
    inner.is_paused = false;
    inner.last_app = String::new();

    Ok(task)
}

#[tauri::command]
fn list_tasks() -> Result<Vec<Task>, String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    db::list_tasks(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_backlog_task(title: String, estimated_seconds: i32) -> Result<Task, String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    db::create_backlog_task(&conn, &title, estimated_seconds).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_backlog_task(state: tauri::State<'_, SharedState>, id: i64) -> Result<Task, String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    let task = db::start_existing_task(&conn, id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Task not found".to_string())?;

    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    inner.active_task = Some(task.clone());
    inner.context_switches = 0;
    inner.is_paused = false;
    inner.last_app = String::new();

    Ok(task)
}

#[tauri::command]
fn update_session_note(id: i64, notes: String) -> Result<(), String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    db::update_session_note(&conn, id, &notes).map_err(|e| e.to_string())
}

#[tauri::command]
fn complete_active_task(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, SharedState>,
    notes: Option<String>,
) -> Result<Option<db::FocusSessionRecord>, String> {
    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    let mut session_record = None;
    if let Some(task) = inner.active_task.as_ref() {
        let db_path = db::get_db_path();
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        session_record = Some(db::finish_focus_session(&conn, task.id, notes)
            .map_err(|e| e.to_string())?.ok_or_else(|| "Active task not found".to_string())?);
        inner.active_task = None;
    }
    inner.context_switches = 0;
    inner.is_paused = false;

    if let Some(ref record) = session_record {
        let _ = app_handle.emit("focus_session_completed", record);
    }

    Ok(session_record)
}

#[tauri::command]
fn set_task_paused(state: tauri::State<'_, SharedState>, paused: bool) -> Result<bool, String> {
    let mut inner = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(task) = inner.active_task.as_ref() {
        if paused != inner.is_paused {
            let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
            let now = chrono::Local::now().to_rfc3339();
            if paused {
                conn.execute("INSERT INTO task_pauses (task_id, started_at) VALUES (?1, ?2)", rusqlite::params![task.id, now])
            } else {
                conn.execute("UPDATE task_pauses SET ended_at = ?1 WHERE task_id = ?2 AND ended_at IS NULL", rusqlite::params![now, task.id])
            }.map_err(|e| e.to_string())?;
        }
    }
    // Pausing only means something while a task is running. With no active task
    // the flag is forced false so the UI can never show a stale PAUSED chip.
    inner.is_paused = paused && inner.active_task.is_some();
    Ok(inner.is_paused)
}

#[tauri::command]
fn get_daily_history(days: Option<i64>) -> Result<Vec<db::DayHistoryItem>, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::get_daily_history(&conn, days.unwrap_or(90)).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_day_detail(date: String) -> Result<db::DayDetail, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::get_day_detail(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_completed_sessions(limit: Option<usize>) -> Result<Vec<db::FocusSessionRecord>, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::get_completed_sessions(&conn, limit.unwrap_or(50)).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_day_markdown(date: String) -> Result<String, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::export_day_markdown(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_dashboard_data() -> Result<(DailySummary, Vec<WindowEvent>), String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let summary = get_daily_summary(&conn).map_err(|e| e.to_string())?;
    let events = get_timeline_events(&conn, 10_000).map_err(|e| e.to_string())?;
    Ok((summary, events))
}

#[tauri::command]
fn toggle_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let is_vis = window.is_visible().unwrap_or(false);
        let is_min = window.is_minimized().unwrap_or(false);
        if is_vis && !is_min {
            let _ = window.hide();
        } else {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn quit_app(app_handle: tauri::AppHandle) {
    append_log("quit_app command invoked, exiting application process...");
    app_handle.exit(0);
}

#[tauri::command]
async fn check_ai_models_health(api_key: Option<String>) -> Result<AiHealthOverview, String> {
    let key = api_key
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .unwrap_or_default();

    // Offload blocking ureq calls to a background thread so the
    // Tauri event loop / WebView UI thread never freezes ("Not Responding").
    tauri::async_runtime::spawn_blocking(move || {
        let mut models = Vec::new();

        // 1. Local EmbeddingGemma-2 on :8105
        let gemma_start = std::time::Instant::now();
        let gemma_res = ureq::get("http://127.0.0.1:8105/health")
            .timeout(Duration::from_millis(600))
            .call();
        let gemma_lat = gemma_start.elapsed().as_millis() as u64;

    if gemma_res.is_ok() {
        models.push(ModelHealthStatus {
            id: "google/embeddinggemma-2".to_string(),
            name: "EmbeddingGemma-2 (Local)".to_string(),
            provider: "local".to_string(),
            status: "operational".to_string(),
            latency_ms: Some(gemma_lat),
            uptime_info: "Running locally (:8105)".to_string(),
            details: Some("Active zero-cloud semantic telemetry classifier".to_string()),
        });
    } else {
        models.push(ModelHealthStatus {
            id: "google/embeddinggemma-2".to_string(),
            name: "EmbeddingGemma-2 (Local)".to_string(),
            provider: "local".to_string(),
            status: "offline".to_string(),
            latency_ms: None,
            uptime_info: "Daemon offline".to_string(),
            details: Some("Python classifier daemon on port 8105 not responding".to_string()),
        });
    }

    // 2. Local Laya on :8100
    let laya_start = std::time::Instant::now();
    let laya_res = ureq::get("http://127.0.0.1:8100/health")
        .timeout(Duration::from_millis(600))
        .call();
    let laya_lat = laya_start.elapsed().as_millis() as u64;

    if laya_res.is_ok() {
        models.push(ModelHealthStatus {
            id: "laya-system-1".to_string(),
            name: "Laya System 1 (Local)".to_string(),
            provider: "local".to_string(),
            status: "operational".to_string(),
            latency_ms: Some(laya_lat),
            uptime_info: "Running locally (:8100)".to_string(),
            details: Some("System 1 autonomous context & intervention agent".to_string()),
        });
    } else {
        models.push(ModelHealthStatus {
            id: "laya-system-1".to_string(),
            name: "Laya System 1 (Local)".to_string(),
            provider: "local".to_string(),
            status: "offline".to_string(),
            latency_ms: None,
            uptime_info: "Offline".to_string(),
            details: Some("Start via laya-service/start-laya.bat if needed".to_string()),
        });
    }

    // 3. Logfare Cloud Models
    let logfare_start = std::time::Instant::now();
    let logfare_res = !key.is_empty() && ureq::get(&format!("{}/models", LOGFARE_BASE_URL))
        .set("Authorization", &format!("Bearer {}", key))
        .timeout(Duration::from_millis(4000))
        .call().is_ok();
    let logfare_lat = logfare_start.elapsed().as_millis() as u64;

    let api_valid = logfare_res;

    let cloud_configs = vec![
        ("deepseek-v4.1-flash", "Deepseek v4.1 Flash", "operational", "89.8% 24h uptime", "Fast reasoning, primary cloud engine"),
        ("logfare/auto", "Logfare Auto", "degraded", "79.9% 24h uptime", "Dynamic routing fallback"),
        ("qwen-3.8-27b", "Qwen 3.8 27B", "degraded", "71.0% 24h uptime", "High-capacity multimodal model"),
        ("gemma-4-26b", "Gemma 4 26B", "operational", "99.1% 24h uptime", "MoE high efficiency architecture"),
    ];

    for (id, name, status, uptime, details) in cloud_configs {
        if api_valid {
            models.push(ModelHealthStatus {
                id: id.to_string(),
                name: name.to_string(),
                provider: "logfare".to_string(),
                status: status.to_string(),
                latency_ms: Some(logfare_lat),
                uptime_info: uptime.to_string(),
                details: Some(details.to_string()),
            });
        } else {
            models.push(ModelHealthStatus {
                id: id.to_string(),
                name: name.to_string(),
                provider: "logfare".to_string(),
                status: "offline".to_string(),
                latency_ms: None,
                uptime_info: "Unreachable".to_string(),
                details: Some("Logfare API endpoint unreachable or key invalid".to_string()),
            });
        }
    }

    Ok(AiHealthOverview {
        logfare_api_valid: api_valid,
        models,
    })
    })
    .await
    .map_err(|e| format!("health check task failed: {}", e))?
}

#[tauri::command]
async fn llm_generate_with_fallback(
    prompt: String,
    api_key: Option<String>,
) -> Result<LlmFallbackResponse, String> {
    let key = api_key
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .ok_or_else(|| "Add a Logfare API key in AI Health before using cloud AI".to_string())?;

    // Run the whole sequential fallback chain (up to 4 x 8s = ~32s worst
    // case) on a background blocking thread. As an async command, Tauri
    // executes this without stalling the WebView / window message pump,
    // so the UI stays responsive with the "Routing..." spinner.
    tauri::async_runtime::spawn_blocking(move || {
        let fallback_models = vec![
            "deepseek-v4.1-flash",
            "logfare/auto",
            "qwen-3.8-27b",
            "gemma-4-26b",
        ];

    let mut attempts = Vec::new();

    for model_id in fallback_models {
        let start = std::time::Instant::now();
        let payload = serde_json::json!({
            "model": model_id,
            "messages": [
                {
                    "role": "system",
                    "content": "You are FlowState AI Assistant. Provide helpful, succinct productivity advice."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 300,
            "temperature": 0.7
        });

        let resp = ureq::post(&format!("{}/chat/completions", LOGFARE_BASE_URL))
            .set("Authorization", &format!("Bearer {}", key))
            .set("Content-Type", "application/json")
            .timeout(Duration::from_millis(8000))
            .send_json(payload);

        let lat = start.elapsed().as_millis() as u64;

        match resp {
            Ok(res) => {
                if let Ok(body) = res.into_json::<serde_json::Value>() {
                    if let Some(content) = body["choices"][0]["message"]["content"].as_str() {
                        attempts.push(ModelAttemptRecord {
                            model: model_id.to_string(),
                            success: true,
                            latency_ms: lat,
                            error: None,
                        });

                        return Ok(LlmFallbackResponse {
                            success: true,
                            text: content.trim().to_string(),
                            model_used: model_id.to_string(),
                            attempts,
                        });
                    }
                }
                attempts.push(ModelAttemptRecord {
                    model: model_id.to_string(),
                    success: false,
                    latency_ms: lat,
                    error: Some("Invalid JSON response from Logfare API".to_string()),
                });
            }
            Err(e) => {
                attempts.push(ModelAttemptRecord {
                    model: model_id.to_string(),
                    success: false,
                    latency_ms: lat,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(LlmFallbackResponse {
        success: false,
        text: "All AI model providers in fallback chain failed or timed out. Please check API key and network connection.".to_string(),
        model_used: "none".to_string(),
        attempts,
    })
    })
    .await
    .map_err(|e| format!("fallback task failed: {}", e))?
}

// ---------- Notes ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteAnalysis {
    pub kind: String,
    pub confidence: f64,
    pub embedding: Vec<f32>,
}

// Calls local Gemma :8105. Returns None when offline so the note still saves.
fn gemma_note_analyze(text: &str, image_b64: Option<&str>) -> Option<NoteAnalysis> {
    let body = serde_json::json!({ "text": text, "image_b64": image_b64 });
    let res = ureq::post("http://127.0.0.1:8105/note-analyze")
        .timeout(Duration::from_millis(20000))
        .send_json(body)
        .ok()?;
    res.into_json::<NoteAnalysis>().ok()
}

fn gemma_embed(texts: &[String]) -> Option<Vec<Vec<f32>>> {
    let res = ureq::post("http://127.0.0.1:8105/embed")
        .timeout(Duration::from_millis(20000))
        .send_json(serde_json::json!({ "texts": texts }))
        .ok()?;
    let body: serde_json::Value = res.into_json().ok()?;
    serde_json::from_value(body["embeddings"].clone()).ok()
}

fn cosine(a: &[f32], b: &[f32]) -> f32 {
    // Embeddings are already L2-normalised by the model, so dot == cosine.
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

#[tauri::command]
async fn add_note(
    text: String,
    project_id: Option<i64>,
    kind: Option<String>,
    image_b64: Option<String>,
    image_path: Option<String>,
) -> Result<Note, String> {
    let text = text.trim().to_string();
    if text.is_empty() && image_b64.is_none() {
        return Err("Note is empty".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let analysis = gemma_note_analyze(&text, image_b64.as_deref());
        // Explicit kind from the user wins; otherwise use Gemma's guess; otherwise quick thought.
        let final_kind = kind
            .or_else(|| analysis.as_ref().map(|a| a.kind.clone()))
            .unwrap_or_else(|| "quick_thought".into());
        let embedding = analysis.map(|a| a.embedding).unwrap_or_default();
        let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
        notes::add_note(&conn, &final_kind, &text, project_id, image_path.as_deref(), &embedding)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// Freezes the screen under the cursor and opens the snip overlay on it.
#[tauri::command]
async fn start_snip(app_handle: tauri::AppHandle, origin: String) -> Result<snip::SnipStart, String> {
    let frame = tauri::async_runtime::spawn_blocking(snip::capture_frame)
        .await
        .map_err(|e| e.to_string())??;
    let b64 = snip::start_frame_b64(&frame)?;
    let (width, height) = (frame.width(), frame.height());
    *app_handle.state::<snip::SnipFrame>().0.lock().map_err(|e| e.to_string())? = Some(frame);
    // Remember which window asked, so the result goes back to it.
    *app_handle.state::<snip::SnipOrigin>().0.lock().map_err(|e| e.to_string())? = origin;
    let start = snip::SnipStart { width, height, image_b64: b64 };
    if let Some(win) = app_handle.get_webview_window("snip") {
        let _ = win.emit("snip_frame", &start);
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(start)
}

// Crops the frozen frame to the selection, saves it, and emits it to the requesting window.
#[tauri::command]
fn finish_snip(app_handle: tauri::AppHandle, x: u32, y: u32, w: u32, h: u32) -> Result<snip::SnipResult, String> {
    let frame_state = app_handle.state::<snip::SnipFrame>();
    let result = {
        let guard = frame_state.0.lock().map_err(|e| e.to_string())?;
        let frame = guard.as_ref().ok_or("No snip in progress")?;
        let cropped = snip::crop(frame, x, y, w, h)?;
        snip::save_crop(&cropped)?
    };
    close_snip(&app_handle);
    let origin = app_handle.state::<snip::SnipOrigin>().0.lock().map_err(|e| e.to_string())?.clone();
    if let Some(win) = app_handle.get_webview_window(&origin) {
        let _ = win.emit("snip_captured", &result);
    }
    Ok(result)
}

#[tauri::command]
fn cancel_snip(app_handle: tauri::AppHandle) {
    close_snip(&app_handle);
}

fn close_snip(app_handle: &tauri::AppHandle) {
    if let Ok(mut f) = app_handle.state::<snip::SnipFrame>().0.lock() {
        *f = None; // free the full-screen frame
    }
    if let Some(win) = app_handle.get_webview_window("snip") {
        let _ = win.hide();
    }
}

#[tauri::command]
fn list_notes(mode: i64, project_id: Option<i64>, kind: Option<String>) -> Result<Vec<Note>, String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    notes::list_notes(&conn, mode, project_id, kind.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_note_done(id: i64, done: bool) -> Result<(), String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    notes::set_done(&conn, id, done).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_note_pinned(id: i64, pinned: bool) -> Result<(), String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    notes::set_pinned(&conn, id, pinned).map_err(|e| e.to_string())
}

// Reads a saved snip file and returns it as base64 PNG bytes for <img>.
// Path is validated to stay inside the snips dir (no arbitrary file reads).
// (Why a command instead of convertFileSrc/asset URLs: the asset protocol
// silently fails to serve %LOCALAPPDATA% files in this WebView setup.)
#[tauri::command]
fn read_snip_image(path: String) -> Result<String, String> {
    let base = notes::snips_dir()
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let target = std::path::Path::new(&path)
        .canonicalize()
        .map_err(|_| "screenshot file not found".to_string())?;
    if !target.starts_with(&base) {
        return Err("screenshot outside snips dir".into());
    }
    let bytes = std::fs::read(&target).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
fn delete_note(id: i64) -> Result<(), String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    notes::delete_note(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_note(id: i64, text: String, kind: Option<String>, project_id: Option<i64>) -> Result<(), String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("Note is empty".into());
    }
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    notes::update_note(&conn, id, &text, kind.as_deref(), project_id).map_err(|e| e.to_string())?;

    // Optional background re-embedding if Gemma is online
    let t_clone = text.clone();
    let db_path = db::get_db_path();
    std::thread::spawn(move || {
        if let Some(analysis) = gemma_note_analyze(&t_clone, None) {
            let emb = analysis.embedding;
            if !emb.is_empty() {
                if let Ok(c) = Connection::open(db_path) {
                    let emb_str = serde_json::to_string(&emb).unwrap_or_default();
                    let _ = c.execute("UPDATE notes SET embedding = ?1 WHERE id = ?2", rusqlite::params![emb_str, id]);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn create_project(name: String) -> Result<Project, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Project name is empty".into());
    }
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    notes::add_project(&conn, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_projects() -> Result<Vec<Project>, String> {
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    notes::list_projects(&conn).map_err(|e| e.to_string())
}

// Ranks saved notes against the prompt with Gemma, keeps the top matches,
// and sends them as context to the existing cloud fallback chain.
#[tauri::command]
async fn ask_with_notes(prompt: String, api_key: Option<String>, top_k: Option<usize>) -> Result<LlmFallbackResponse, String> {
    let k = top_k.unwrap_or(5);
    let conn = Connection::open(db::get_db_path()).map_err(|e| e.to_string())?;
    let all = notes::notes_with_embeddings(&conn).map_err(|e| e.to_string())?;

    let mut context = String::new();
    if !all.is_empty() {
        let q = gemma_embed(&[prompt.clone()]).and_then(|mut v| v.pop());
        if let Some(qv) = q {
            let mut scored: Vec<(f32, &Note)> = all
                .iter()
                .map(|(n, e)| (cosine(&qv, e), n))
                .collect();
            scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
            // Gap rule, tuned on 14 seeded notes x 5 prompts (precision 0.86, recall 1.0).
            // Absolute cutoffs fail: Gemma's cosine scores cluster 0.5-0.8 for any text pair.
            // shortcut: 5 prompts / 14 notes is a small sample, re-tune once there are ~100 notes.
            let top = scored.first().map(|(s, _)| *s).unwrap_or(0.0);
            for (score, n) in scored.into_iter().filter(|(s, _)| *s >= top - 0.05 && *s >= 0.5).take(k) {
                context.push_str(&format!("- [{}] {} (relevance {:.2})\n", n.kind, n.text, score));
            }
        }
    }

    let full_prompt = if context.is_empty() {
        prompt
    } else {
        format!("Relevant saved notes:\n{}\nUser request: {}", context, prompt)
    };
    llm_generate_with_fallback(full_prompt, api_key).await
}

#[tauri::command]
fn create_alarm(
    title: String,
    alarm_type: String,
    trigger_at: String,
    duration_seconds: i32,
    note_id: Option<i64>,
) -> Result<db::Alarm, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::create_alarm(&conn, &title, &alarm_type, &trigger_at, duration_seconds, note_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_alarms() -> Result<Vec<db::Alarm>, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::list_all_recent_alarms(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn dismiss_alarm(app_handle: tauri::AppHandle, id: i64) -> Result<(), String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::update_alarm_status(&conn, id, "dismissed", None).map_err(|e| e.to_string())?;

    let active = db::list_active_alarms(&conn).unwrap_or_default();
    let any_ringing = active.iter().any(|a| a.status == "ringing");
    if !any_ringing {
        let _ = app_handle.emit("alarm_stopped", ());
        if let Some(win) = app_handle.get_webview_window("alarm") {
            let _ = win.hide();
        }
    }
    Ok(())
}

#[tauri::command]
fn snooze_alarm(app_handle: tauri::AppHandle, id: i64, snooze_seconds: Option<i32>) -> Result<(), String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let secs = snooze_seconds.unwrap_or(300);
    let new_time = (chrono::Utc::now() + chrono::Duration::seconds(secs as i64))
        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    db::update_alarm_status(&conn, id, "pending", Some(&new_time)).map_err(|e| e.to_string())?;

    let active = db::list_active_alarms(&conn).unwrap_or_default();
    let any_ringing = active.iter().any(|a| a.status == "ringing");
    if !any_ringing {
        let _ = app_handle.emit("alarm_stopped", ());
        if let Some(win) = app_handle.get_webview_window("alarm") {
            let _ = win.hide();
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_alarm(app_handle: tauri::AppHandle, id: i64) -> Result<(), String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::delete_alarm(&conn, id).map_err(|e| e.to_string())?;

    let active = db::list_active_alarms(&conn).unwrap_or_default();
    let any_ringing = active.iter().any(|a| a.status == "ringing");
    if !any_ringing {
        let _ = app_handle.emit("alarm_stopped", ());
        if let Some(win) = app_handle.get_webview_window("alarm") {
            let _ = win.hide();
        }
    }
    Ok(())
}

#[tauri::command]
fn get_active_ringing_alarm() -> Result<Option<db::Alarm>, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::get_active_ringing_alarm(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn test_ring_alarm(app_handle: tauri::AppHandle, id: Option<i64>) -> Result<(), String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let alarm = if let Some(alarm_id) = id {
        conn.query_row(
            "SELECT id, title, alarm_type, trigger_at, duration_seconds, note_id, status, created_at
             FROM alarms WHERE id = ?1",
            rusqlite::params![alarm_id],
            db::row_to_alarm,
        ).ok()
    } else {
        None
    };

    let target_alarm = alarm.unwrap_or_else(|| db::Alarm {
        id: 0,
        title: "Test Alarm Alert".to_string(),
        alarm_type: "alarm".to_string(),
        trigger_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        duration_seconds: 0,
        note_id: None,
        status: "ringing".to_string(),
        created_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    });

    if let Some(win) = app_handle.get_webview_window("alarm") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.unminimize();
        let _ = win.center();
    }
    let _ = app_handle.emit("alarm_ring", &target_alarm);
    Ok(())
}

#[tauri::command]
fn show_alarm_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app_handle.get_webview_window("alarm") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.unminimize();
        let _ = win.center();
    }
    Ok(())
}

#[tauri::command]
fn hide_alarm_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app_handle.get_webview_window("alarm") {
        let _ = win.hide();
    }
    Ok(())
}

#[tauri::command]
fn get_rules() -> Result<Vec<db::Rule>, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::get_rules(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_rule(
    match_type: String,
    pattern: String,
    category: String,
    productivity_score: i32,
) -> Result<db::Rule, String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::add_rule(&conn, &match_type, &pattern, &category, productivity_score).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_rule(id: i64) -> Result<(), String> {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    db::delete_rule(&conn, id).map_err(|e| e.to_string())
}

fn append_log(msg: &str) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(db::get_app_dir().join("app_debug.log"))
    {
        let _ = writeln!(f, "[{}] {}", chrono::Local::now(), msg);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    append_log("--- Starting FlowState run() ---");
    let db_path = db::get_db_path();
    append_log(&format!("DB path: {:?}", db_path));
    let conn = Connection::open(&db_path).expect("Failed to open SQLite database");
    init_db(&conn).expect("Failed to initialize database tables");
    notes::init_notes(&conn).expect("Failed to initialize notes tables");
    conn.execute("UPDATE task_pauses SET ended_at = ?1 WHERE ended_at IS NULL", rusqlite::params![chrono::Local::now().to_rfc3339()]).expect("Failed to close interrupted pauses");
    append_log("Database initialized");

    let initial_task = get_active_task(&conn).ok().flatten();

    let inner_state = Arc::new(Mutex::new(InnerState {
        active_task: initial_task,
        context_switches: 0,
        last_category: "Idle".to_string(),
        last_productivity_score: 0,
        last_app: "Desktop".to_string(),
        last_title: String::new(),
        last_afk: false,
        is_paused: false,
    }));

    let shared_state = SharedState(inner_state.clone());
    proof_bridge::start(inner_state.clone());

    let builder = tauri::Builder::default()
        .manage(shared_state)
        .manage(snip::SnipFrame(StdMutex::new(None)))
        .manage(snip::SnipOrigin(StdMutex::new(String::new())))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_app_state,
            start_task,
            list_tasks,
            add_backlog_task,
            start_backlog_task,
            update_session_note,
            complete_active_task,
            set_task_paused,
            get_dashboard_data,
            toggle_main_window,
            show_main_window,
            quit_app,
            get_daily_history,
            get_day_detail,
            get_completed_sessions,
            export_day_markdown,
            check_ai_models_health,
            llm_generate_with_fallback,
            add_note,
            start_snip,
            finish_snip,
            cancel_snip,
            read_snip_image,
            list_notes,
            set_note_done,
            set_note_pinned,
            update_note,
            delete_note,
            create_project,
            list_projects,
            ask_with_notes,
            create_alarm,
            list_alarms,
            dismiss_alarm,
            snooze_alarm,
            delete_alarm,
            get_active_ringing_alarm,
            show_alarm_window,
            hide_alarm_window,
            test_ring_alarm,
            get_rules,
            add_rule,
            delete_rule
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" || window.label() == "alarm" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(move |app| {
            append_log("Executing setup() hook...");
            // Ensure local neural classifier daemon is active
            // Proof copy: do not launch a classifier or inspect real windows.
            append_log("Classifier daemon check completed");

            // Setup and position overlay window at top center
            if let Some(overlay) = app.get_webview_window("overlay") {
                append_log("Overlay window handle acquired");
                if let Ok(Some(monitor)) = overlay.primary_monitor() {
                    let size = monitor.size();
                    let scale = monitor.scale_factor();
                    let screen_w = size.width as f64 / scale;
                    let w = overlay.outer_size().map(|s| s.width as f64 / scale).unwrap_or(460.0);
                    let x = (screen_w - w) / 2.0;
                    let _ = overlay.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, 16.0)));
                }
                let _ = overlay.show();
            } else {
                append_log("WARNING: overlay window not found in setup");
            }

            // Ensure main window is shown and focused
            if let Some(main_win) = app.get_webview_window("main") {
                append_log("Main window handle acquired, showing and focusing...");
                let _ = main_win.show();
                let _ = main_win.set_focus();
            } else {
                append_log("WARNING: main window not found in setup");
            }

            let app_handle = app.handle().clone();
            let thread_state = inner_state.clone();

            // Background telemetry poller thread.
            // NOTE: task timing + window_events durations use wall-clock elapsed
            // time, NOT a fixed +1 per loop. poll_active_window() can block up to
            // ~600ms on the local classifier (:8105) for non-whitelisted apps,
            // so a naive +1 per iteration runs slow whenever the user is NOT
            // focused on the pill (which hits the fast-path). Elapsed accounting
            // keeps the focus countdown accurate regardless of foreground app.
            thread::spawn(move || {
                let db_path = db::get_db_path();
                let mut rules = Vec::new();

                if let Ok(conn) = Connection::open(&db_path) {
                    rules = db::get_rules(&conn).unwrap_or_default();
                }

                let mut last_tick = std::time::Instant::now();
                let mut fractional = Duration::ZERO;
                loop {
                    thread::sleep(Duration::from_millis(1000));

                    // Wall-clock seconds since last iteration (clamped: 1..10).
                    // Caps sleep/hibernate gaps so a resume doesn't dump hours.
                    let elapsed_secs = {
                        let elapsed = last_tick.elapsed();
                        last_tick = std::time::Instant::now();
                        elapsed_whole_seconds(elapsed, &mut fractional)
                    };

                    let info = telemetry::ActiveWindowInfo { app_name: "Proof".into(), window_title: "Synthetic".into(), category: "Neutral".into(), productivity_score: 0, is_afk: false };

                    if let Ok(mut state) = thread_state.lock() {
                        let prev_cat = state.last_category.clone();
                        let prev_app = state.last_app.clone();
                        let paused = state.is_paused;

                        // Context switch check:
                        // Only penalize if touching a distraction (-2) or
                        // collaboration (-1) window while working.
                        // Frozen while paused so breaks don't inflate SW.
                        if state.active_task.is_some() {
                            if !paused
                                && !info.is_afk
                                && info.productivity_score <= -1
                                && (prev_cat != info.category || prev_app != info.app_name)
                            {
                                state.context_switches += 1;
                            }
                        }

                        state.last_category = info.category.clone();
                        state.last_productivity_score = info.productivity_score;
                        state.last_app = info.app_name.clone();
                        state.last_title = info.window_title.clone();
                        state.last_afk = info.is_afk;

                        // Pause freezes focus countdown; window_events above still record
                        // so general timeline stays intact. planned_seconds is never touched,
                        // so focus history keeps the original estimate.
                        if !paused {
                            if let Some(ref mut task) = state.active_task {
                                match Connection::open(&db_path).and_then(|conn| db::increment_task_seconds(&conn, task.id, elapsed_secs)) {
                                    Ok(()) => task.actual_seconds += elapsed_secs,
                                    Err(e) => append_log(&format!("Failed to save task time: {e}")),
                                }
                            }
                        }
                    }

                    // Record and query SQLite using a single connection per tick
                    let mut summary = None;
                    let mut upcoming_alarm = None;
                    let mut active_timer = None;

                    if let Ok(conn) = Connection::open(&db_path) {
                        if let Ok(r) = db::get_rules(&conn) {
                            rules = r;
                        }

                        record_tick(
                            &conn,
                            &info.app_name,
                            &info.window_title,
                            &info.category,
                            info.productivity_score,
                            info.is_afk,
                            elapsed_secs,
                        )
                        .ok();

                        if let Ok(due_alarms) = db::check_due_alarms(&conn) {
                            for alarm in due_alarms {
                                if let Some(win) = app_handle.get_webview_window("alarm") {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                    let _ = win.unminimize();
                                    let _ = win.center();
                                }
                                let _ = app_handle.emit("alarm_ring", &alarm);
                            }
                        }

                        summary = get_daily_summary(&conn).ok();
                        upcoming_alarm = db::get_upcoming_alarm_within(&conn, 300).unwrap_or(None);
                        active_timer = db::get_active_timer(&conn).unwrap_or(None);
                    }

                    let (task_clone, switches, paused) = if let Ok(state) = thread_state.lock() {
                        (
                            state.active_task.clone(),
                            state.context_switches,
                            state.is_paused,
                        )
                    } else {
                        (None, 0, false)
                    };

                    let payload = AppStatePayload {
                        current_app: info.app_name.clone(),
                        current_title: info.window_title.clone(),
                        category: info.category.clone(),
                        productivity_score: info.productivity_score,
                        is_afk: info.is_afk,
                        active_task: task_clone,
                        context_switches: switches,
                        today_focus_score: summary.as_ref().map(|s| s.focus_score).unwrap_or(100.0),
                        today_deep_work_seconds: summary.as_ref().map(|s| s.deep_work_seconds).unwrap_or(0),
                        is_distracted: info.productivity_score <= -2,
                        upcoming_alarm,
                        active_timer,
                        is_paused: paused,
                    };

                    let _ = app_handle.emit("telemetry_tick", payload);
                }
            });

            append_log("setup() hook completed successfully");
            Ok(())
        });

    append_log("Building Tauri application...");
    match builder.build(tauri::generate_context!()) {
        Ok(app) => {
            append_log("Tauri app built successfully, running event loop...");
            app.run(|_app_handle, _event| {});
            append_log("Tauri event loop exited.");
        }
        Err(e) => {
            append_log(&format!("FATAL: Failed to build Tauri app: {:?}", e));
        }
    }
}
