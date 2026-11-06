use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowEvent {
    pub id: i64,
    pub app_name: String,
    pub window_title: String,
    pub category: String,
    pub productivity_score: i32,
    pub started_at: String,
    pub duration_seconds: i32,
    pub is_afk: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: i64,
    pub match_type: String, // "app_regex", "title_regex"
    pub pattern: String,
    pub category: String,
    pub productivity_score: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub estimated_seconds: i32,
    pub actual_seconds: i32,
    pub status: String,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySummary {
    pub total_seconds: i32,
    pub deep_work_seconds: i32,
    pub communication_seconds: i32,
    pub distraction_seconds: i32,
    pub focus_score: f64,
    pub context_switches: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppTimeUsage {
    pub app_name: String,
    pub category: String,
    pub duration_seconds: i32,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusSessionRecord {
    pub id: i64,
    pub task_id: i64,
    pub task_title: String,
    pub planned_seconds: i32,
    pub actual_seconds: i32,
    pub started_at: String,
    pub ended_at: String,
    pub context_switches: i32,
    pub focus_score: f64,
    pub apps: Vec<AppTimeUsage>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayHistoryItem {
    pub date: String,
    pub total_seconds: i32,
    pub deep_work_seconds: i32,
    pub focus_score: f64,
    pub session_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayDetail {
    pub date: String,
    pub summary: DailySummary,
    pub top_apps: Vec<AppTimeUsage>,
    pub sessions: Vec<FocusSessionRecord>,
    pub timeline: Vec<WindowEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alarm {
    pub id: i64,
    pub title: String,
    pub alarm_type: String, // "timer" | "alarm"
    pub trigger_at: String, // RFC3339 timestamp
    pub duration_seconds: i32,
    pub note_id: Option<i64>,
    pub status: String, // "pending" | "ringing" | "dismissed"
    pub created_at: String,
}

pub fn get_app_dir() -> PathBuf {
    let mut path = dirs_next::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("FlowState");
    std::fs::create_dir_all(&path).ok();
    path
}

pub fn get_db_path() -> PathBuf {
    get_app_dir().join("flowstate.db")
}

// Fallback dirs helper if dirs_next not loaded
mod dirs_next {
    use std::path::PathBuf;
    pub fn data_local_dir() -> Option<PathBuf> {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
    }
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;

         CREATE TABLE IF NOT EXISTS window_events (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             app_name TEXT NOT NULL,
             window_title TEXT NOT NULL,
             category TEXT NOT NULL,
             productivity_score INTEGER NOT NULL,
             started_at TEXT NOT NULL,
             duration_seconds INTEGER NOT NULL,
             is_afk BOOLEAN DEFAULT 0
         );

         CREATE TABLE IF NOT EXISTS rules (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             match_type TEXT NOT NULL,
             pattern TEXT NOT NULL,
             category TEXT NOT NULL,
             productivity_score INTEGER NOT NULL
         );

         CREATE TABLE IF NOT EXISTS tasks (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             title TEXT NOT NULL,
             estimated_seconds INTEGER NOT NULL,
             actual_seconds INTEGER DEFAULT 0,
             status TEXT DEFAULT 'pending',
             created_at TEXT DEFAULT CURRENT_TIMESTAMP,
             completed_at TEXT
         );

         CREATE TABLE IF NOT EXISTS focus_sessions (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             task_id INTEGER,
             task_title TEXT NOT NULL DEFAULT '',
             planned_seconds INTEGER NOT NULL DEFAULT 0,
             actual_seconds INTEGER NOT NULL DEFAULT 0,
             started_at TEXT NOT NULL,
             ended_at TEXT,
             context_switches INTEGER DEFAULT 0,
             focus_score REAL DEFAULT 100.0,
             app_breakdown_json TEXT DEFAULT '[]',
             notes TEXT DEFAULT ''
         );
         CREATE TABLE IF NOT EXISTS task_pauses (
             task_id INTEGER NOT NULL,
             started_at TEXT NOT NULL,
             ended_at TEXT
         );",
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS alarms (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             title TEXT NOT NULL,
             alarm_type TEXT NOT NULL,
             trigger_at TEXT NOT NULL,
             duration_seconds INTEGER DEFAULT 0,
             note_id INTEGER,
             status TEXT DEFAULT 'pending',
             created_at TEXT DEFAULT CURRENT_TIMESTAMP
         );",
    )?;

    // Backward-compatible column additions
    conn.execute("ALTER TABLE focus_sessions ADD COLUMN task_title TEXT DEFAULT ''", []).ok();
    conn.execute("ALTER TABLE focus_sessions ADD COLUMN planned_seconds INTEGER DEFAULT 0", []).ok();
    conn.execute("ALTER TABLE focus_sessions ADD COLUMN actual_seconds INTEGER DEFAULT 0", []).ok();
    conn.execute("ALTER TABLE focus_sessions ADD COLUMN context_switches INTEGER DEFAULT 0", []).ok();
    conn.execute("ALTER TABLE focus_sessions ADD COLUMN app_breakdown_json TEXT DEFAULT '[]'", []).ok();
    conn.execute("ALTER TABLE focus_sessions ADD COLUMN notes TEXT DEFAULT ''", []).ok();

    // Check if enriched developer rules exist; if not, seed or upgrade them
    let has_antigravity: i64 = conn
        .query_row("SELECT COUNT(*) FROM rules WHERE pattern LIKE '%antigravity%'", [], |r| r.get(0))
        .unwrap_or(0);

    if has_antigravity == 0 {
        let defaults = vec![
            ("app_regex", "(?i)antigravity|flowstate|tauri-app|code|cursor|devenv|idea64|pycharm64|webstorm64|rider64|clion64|zed|sublime_text|notepad\\+\\+|nvim|neovim|git|cargo", "Software Engineering", 2),
            ("app_regex", "(?i)windowsterminal|wezterm-gui|alacritty|powershell|cmd|bash|mintty", "Software Engineering", 2),
            ("title_regex", "(?i)visual studio code|cursor|antigravity|rust|typescript|python", "Software Engineering", 2),
            ("title_regex", "(?i)github|stackoverflow|crates\\.io|docs\\.rs|npmjs|developer\\.mozilla|linear|notion|obsidian|devdocs|localhost|127\\.0\\.0\\.1", "Research & Documentation", 1),
            ("app_regex", "(?i)obsidian|notion", "Research & Documentation", 1),
            ("app_regex", "(?i)slack|teams|discord|telegram|zoom|whatsapp|signal", "Team Communication", -1),
            ("title_regex", "(?i)youtube|reddit|twitter|x\\.com|twitch|netflix|facebook|instagram|tiktok", "Social Media & Feeds", -2),
        ];

        for (m_type, pat, cat, score) in defaults {
            conn.execute(
                "INSERT INTO rules (match_type, pattern, category, productivity_score) VALUES (?1, ?2, ?3, ?4)",
                params![m_type, pat, cat, score],
            ).ok();
        }
    }

    // Migrate any legacy rule categories to live taxonomy names
    let _ = conn.execute("UPDATE rules SET category = 'Software Engineering' WHERE category = 'Coding'", []);
    let _ = conn.execute("UPDATE rules SET category = 'Research & Documentation' WHERE category = 'Knowledge & Docs'", []);
    let _ = conn.execute("UPDATE rules SET category = 'Team Communication' WHERE category = 'Communication'", []);
    let _ = conn.execute("UPDATE rules SET category = 'Social Media & Feeds' WHERE category = 'Distraction'", []);

    // Recompute focus_score, context_switches, and app_breakdown_json for sessions
    match backfill_session_focus_scores(conn) {
        Ok(n) if n > 0 => {
            eprintln!("[db] backfilled focus scores for {n} session(s)");
        }
        Ok(_) => {}
        Err(e) => eprintln!("[db] focus score backfill failed: {e}"),
    }

    Ok(())
}

pub fn record_tick(
    conn: &Connection,
    app_name: &str,
    window_title: &str,
    category: &str,
    score: i32,
    is_afk: bool,
    secs: i32,
) -> Result<()> {
    let secs = secs.clamp(1, 10);
    let now = chrono::Local::now().to_rfc3339();

    // Check last event
    let last_event: Option<(i64, String, String, String, bool, String, i32, i32)> = conn
        .query_row(
            "SELECT id, app_name, window_title, category, is_afk, started_at, duration_seconds, productivity_score FROM window_events ORDER BY id DESC LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?)),
        )
        .ok();

    if let Some((id, last_app, last_title, last_cat, last_afk, last_started_at, last_duration, last_score)) = last_event {
        if last_app == app_name
            && last_title == window_title
            && last_cat == category
            && last_afk == is_afk
            && last_score == score
            && last_started_at.get(..10) == now.get(..10)
            && parse_to_utc(&last_started_at).zip(parse_to_utc(&now)).map_or(false, |(start, end)| {
                let gap = (end - start).num_seconds() - i64::from(last_duration);
                gap >= 0 && gap <= i64::from(secs) + 2
            })
        {
            // Extend existing interval by wall-clock elapsed seconds
            // (loop iteration can exceed 1s when the classifier daemon blocks).
            conn.execute(
                "UPDATE window_events SET duration_seconds = duration_seconds + ?1 WHERE id = ?2",
                params![secs, id],
            )?;
            return Ok(());
        }
    }

    // Insert new interval
    conn.execute(
        "INSERT INTO window_events (app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![app_name, window_title, category, score, now, secs, is_afk],
    )?;

    Ok(())
}

pub fn get_rules(conn: &Connection) -> Result<Vec<Rule>> {
    let mut stmt = conn.prepare("SELECT id, match_type, pattern, category, productivity_score FROM rules")?;
    let rules = stmt
        .query_map([], |r| {
            Ok(Rule {
                id: r.get(0)?,
                match_type: r.get(1)?,
                pattern: r.get(2)?,
                category: r.get(3)?,
                productivity_score: r.get(4)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rules)
}

pub fn add_rule(
    conn: &Connection,
    match_type: &str,
    pattern: &str,
    category: &str,
    productivity_score: i32,
) -> Result<Rule> {
    conn.execute(
        "INSERT INTO rules (match_type, pattern, category, productivity_score) VALUES (?1, ?2, ?3, ?4)",
        params![match_type, pattern, category, productivity_score],
    )?;
    let id = conn.last_insert_rowid();
    Ok(Rule {
        id,
        match_type: match_type.to_string(),
        pattern: pattern.to_string(),
        category: category.to_string(),
        productivity_score,
    })
}

pub fn delete_rule(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM rules WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_timeline_events(conn: &Connection, limit: usize) -> Result<Vec<WindowEvent>> {
    let today_prefix = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut stmt = conn.prepare(
        "SELECT id, app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk
         FROM window_events WHERE started_at LIKE ?1 ORDER BY id DESC LIMIT ?2",
    )?;

    let events = stmt
        .query_map(params![format!("{today_prefix}%"), limit], |r| {
            Ok(WindowEvent {
                id: r.get(0)?,
                app_name: r.get(1)?,
                window_title: r.get(2)?,
                category: r.get(3)?,
                productivity_score: r.get(4)?,
                started_at: r.get(5)?,
                duration_seconds: r.get(6)?,
                is_afk: r.get(7)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();

    Ok(events)
}

pub fn compute_day_summary(conn: &Connection, date_prefix: &str) -> Result<DailySummary> {
    let mut stmt = conn.prepare(
        "SELECT app_name, category, productivity_score, duration_seconds, is_afk
         FROM window_events WHERE started_at LIKE ?1 ORDER BY id ASC",
    )?;

    let mut total_seconds = 0;
    let mut deep_work_seconds = 0;
    let mut communication_seconds = 0;
    let mut distraction_seconds = 0;
    let mut productive_seconds = 0;
    let mut context_switches = 0;
    let mut prev_app = String::new();
    let mut prev_cat = String::new();
    let mut prev_score = 0i32;

    let rows = stmt.query_map(params![date_prefix], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i32>(2)?,
            r.get::<_, i32>(3)?,
            r.get::<_, bool>(4)?,
        ))
    })?;

    for row in rows.flatten() {
        let (app, cat, score, dur, is_afk) = row;
        if is_afk {
            continue;
        }
        total_seconds += dur;
        if score == 2 {
            deep_work_seconds += dur;
            productive_seconds += dur;
        } else if score == 1 {
            productive_seconds += dur;
        } else if cat == "Team Communication" || cat == "Communication" || score == -1 {
            communication_seconds += dur;
        } else if cat == "Social Media & Feeds" || cat == "Distraction" || score <= -2 {
            distraction_seconds += dur;
        }

        if score <= -1 && !prev_app.is_empty() && (prev_app != app || prev_cat != cat || prev_score > -1) {
            context_switches += 1;
        }
        prev_app = app;
        prev_cat = cat;
        prev_score = score;
    }

    let focus_score = if total_seconds > 0 {
        ((productive_seconds as f64) / (total_seconds as f64)) * 100.0
    } else {
        100.0
    };

    Ok(DailySummary {
        total_seconds,
        deep_work_seconds,
        communication_seconds,
        distraction_seconds,
        focus_score: (focus_score * 10.0).round() / 10.0,
        context_switches,
    })
}

pub fn get_daily_summary(conn: &Connection) -> Result<DailySummary> {
    let today_prefix = format!("{}%", chrono::Local::now().format("%Y-%m-%d"));
    compute_day_summary(conn, &today_prefix)
}

pub fn create_task(conn: &Connection, title: &str, estimated_seconds: i32) -> Result<Task> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute("UPDATE task_pauses SET ended_at = ?1 WHERE ended_at IS NULL", params![&now])?;
    // Complete or deactivate any stale active tasks so only one task is active at a time
    conn.execute("UPDATE tasks SET status = 'pending' WHERE status = 'active'", []).ok();
    conn.execute(
        "INSERT INTO tasks (title, estimated_seconds, actual_seconds, status, created_at)
         VALUES (?1, ?2, 0, 'active', ?3)",
        params![title, estimated_seconds, &now],
    )?;
    let id = conn.last_insert_rowid();

    if let Ok(Some((app, title, cat, score, afk))) = conn.query_row(
        "SELECT app_name, window_title, category, productivity_score, is_afk FROM window_events ORDER BY id DESC LIMIT 1",
        [],
        |r| Ok(Some((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, i32>(3)?, r.get::<_, bool>(4)?))),
    ) {
        let _ = conn.execute(
            "INSERT INTO window_events (app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
            params![app, title, cat, score, &now, afk],
        );
    }

    Ok(Task {
        id,
        title: title.to_string(),
        estimated_seconds,
        actual_seconds: 0,
        status: "active".to_string(),
        created_at: now,
        completed_at: None,
    })
}

pub fn create_backlog_task(conn: &Connection, title: &str, estimated_seconds: i32) -> Result<Task> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO tasks (title, estimated_seconds, actual_seconds, status, created_at)
         VALUES (?1, ?2, 0, 'pending', ?3)",
        params![title, estimated_seconds, now],
    )?;
    let id = conn.last_insert_rowid();
    Ok(Task {
        id,
        title: title.to_string(),
        estimated_seconds,
        actual_seconds: 0,
        status: "pending".to_string(),
        created_at: now,
        completed_at: None,
    })
}

pub fn start_existing_task(conn: &Connection, id: i64) -> Result<Option<Task>> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute("UPDATE task_pauses SET ended_at = ?1 WHERE ended_at IS NULL", params![&now])?;
    conn.execute("UPDATE tasks SET status = 'pending' WHERE status = 'active'", []).ok();
    conn.execute(
        "UPDATE tasks SET status = 'active', created_at = ?1, actual_seconds = 0 WHERE id = ?2",
        params![&now, id],
    )?;
    if let Ok(Some((app, title, cat, score, afk))) = conn.query_row(
        "SELECT app_name, window_title, category, productivity_score, is_afk FROM window_events ORDER BY id DESC LIMIT 1",
        [],
        |r| Ok(Some((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, i32>(3)?, r.get::<_, bool>(4)?))),
    ) {
        let _ = conn.execute(
            "INSERT INTO window_events (app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
            params![app, title, cat, score, &now, afk],
        );
    }
    let task = conn
        .query_row(
            "SELECT id, title, estimated_seconds, actual_seconds, status, created_at, completed_at
             FROM tasks WHERE id = ?1",
            params![id],
            |r| {
                Ok(Task {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    estimated_seconds: r.get(2)?,
                    actual_seconds: r.get(3)?,
                    status: r.get(4)?,
                    created_at: r.get(5)?,
                    completed_at: r.get(6)?,
                })
            },
        )
        .ok();
    Ok(task)
}

pub fn list_tasks(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, estimated_seconds, actual_seconds, status, created_at, completed_at
         FROM tasks
         ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 0 END ASC, id DESC
         LIMIT 50",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Task {
                id: r.get(0)?,
                title: r.get(1)?,
                estimated_seconds: r.get(2)?,
                actual_seconds: r.get(3)?,
                status: r.get(4)?,
                created_at: r.get(5)?,
                completed_at: r.get(6)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

pub fn get_active_task(conn: &Connection) -> Result<Option<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, estimated_seconds, actual_seconds, status, created_at, completed_at
         FROM tasks WHERE status = 'active' ORDER BY id DESC LIMIT 1",
    )?;
    let task = stmt
        .query_row([], |r| {
            Ok(Task {
                id: r.get(0)?,
                title: r.get(1)?,
                estimated_seconds: r.get(2)?,
                actual_seconds: r.get(3)?,
                status: r.get(4)?,
                created_at: r.get(5)?,
                completed_at: r.get(6)?,
            })
        })
        .ok();
    Ok(task)
}

#[allow(dead_code)]
pub fn complete_task(conn: &Connection, id: i64) -> Result<()> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "UPDATE tasks SET status = 'completed', completed_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

pub fn increment_task_seconds(conn: &Connection, id: i64, secs: i32) -> Result<()> {
    let secs = secs.clamp(1, 10);
    conn.execute(
        "UPDATE tasks SET actual_seconds = actual_seconds + ?1 WHERE id = ?2",
        params![secs, id],
    )?;
    Ok(())
}

pub fn update_session_note(conn: &Connection, id: i64, notes: &str) -> Result<()> {
    conn.execute(
        "UPDATE focus_sessions SET notes = ?1 WHERE id = ?2",
        params![notes, id],
    )?;
    Ok(())
}

fn compute_span_metrics(
    conn: &Connection,
    started_at: &str,
    ended_at: &str,
    task_id: Option<i64>,
) -> Result<(i32, f64, i32, Vec<AppTimeUsage>)> {
    let mut stmt = conn.prepare(
        "SELECT app_name, category, productivity_score, duration_seconds, started_at
         FROM window_events
         WHERE started_at >= ?1 AND started_at <= ?2 AND is_afk = 0
         ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(params![started_at, ended_at], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i32>(2)?,
            r.get::<_, i32>(3)?,
            r.get::<_, String>(4)?,
        ))
    })?;

    let mut pauses = Vec::new();
    if let Some(id) = task_id {
        let mut stmt = conn.prepare("SELECT started_at, ended_at FROM task_pauses WHERE task_id = ?1")?;
        for row in stmt.query_map(params![id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?)))? {
            let (start, end) = row?;
            if let (Some(start), Some(end)) = (parse_to_utc(&start), parse_to_utc(end.as_deref().unwrap_or(ended_at))) {
                pauses.push((start, end));
            }
        }
    }
    use std::collections::HashMap;
    let mut session_total_sec = 0i32;
    let mut session_productive_sec = 0i32;
    let mut context_switches = 0i32;
    let mut prev_app = String::new();
    let mut prev_cat = String::new();
    let mut prev_score = 0i32;
    // Map app_name -> (total_dur, dominant_cat, dominant_cat_dur)
    let mut app_map: HashMap<String, (i32, String, i32)> = HashMap::new();
    let mut app_cat_durs: HashMap<(String, String), i32> = HashMap::new();

    for row in rows.flatten() {
        let (app, cat, score, mut dur, event_start) = row;
        if let Some(start) = parse_to_utc(&event_start) {
            let end = start + chrono::Duration::seconds(i64::from(dur));
            for (pause_start, pause_end) in &pauses {
                dur -= (end.min(*pause_end) - start.max(*pause_start)).num_seconds().max(0) as i32;
            }
        }
        if dur <= 0 { continue; }
        session_total_sec += dur;
        if score >= 1 {
            session_productive_sec += dur;
        }
        if score <= -1 && !prev_app.is_empty() && (prev_app != app || prev_cat != cat || prev_score > -1) {
            context_switches += 1;
        }
        prev_app = app.clone();
        prev_cat = cat.clone();
        prev_score = score;

        let cat_dur = {
            let e = app_cat_durs.entry((app.clone(), cat.clone())).or_insert(0);
            *e += dur;
            *e
        };
        let entry = app_map.entry(app).or_insert_with(|| (0, cat.clone(), 0));
        entry.0 += dur;
        if cat_dur > entry.2 {
            entry.1 = cat;
            entry.2 = cat_dur;
        }
    }

    let mut raw_apps: Vec<(String, String, i32)> = app_map
        .into_iter()
        .map(|(app, (dur, cat, _))| (app, cat, dur))
        .collect();
    raw_apps.sort_by(|a, b| b.2.cmp(&a.2));

    let total_for_pct = if session_total_sec > 0 {
        session_total_sec as f64
    } else {
        1.0
    };
    let apps: Vec<AppTimeUsage> = raw_apps
        .into_iter()
        .map(|(app, cat, dur)| {
            let pct = ((dur as f64) / total_for_pct) * 100.0;
            AppTimeUsage {
                app_name: app,
                category: cat,
                duration_seconds: dur,
                percentage: (pct * 10.0).round() / 10.0,
            }
        })
        .collect();

    let focus_score = if session_total_sec > 0 {
        (((session_productive_sec as f64) / (session_total_sec as f64)) * 1000.0).round() / 10.0
    } else {
        100.0
    };

    Ok((session_total_sec, focus_score, context_switches, apps))
}

pub fn finish_focus_session(
    conn: &Connection,
    task_id: i64,
    notes: Option<String>,
) -> Result<Option<FocusSessionRecord>> {
    let now = chrono::Local::now().to_rfc3339();

    // 1. Get task details
    let task = conn
        .query_row(
            "SELECT id, title, estimated_seconds, actual_seconds, created_at FROM tasks WHERE id = ?1",
            params![task_id],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i32>(2)?,
                    r.get::<_, i32>(3)?,
                    r.get::<_, String>(4)?,
                ))
            },
        )
        .ok();

    let (t_id, title, planned_sec, actual_sec, started_at) = match task {
        Some(t) => t,
        None => return Ok(None),
    };

    conn.execute_batch("SAVEPOINT finish_focus_session")?;
    let result = (|| -> Result<FocusSessionRecord> {
    conn.execute("UPDATE task_pauses SET ended_at = ?1 WHERE task_id = ?2 AND ended_at IS NULL", params![&now, task_id])?;
    // 2. Mark task completed
    conn.execute(
        "UPDATE tasks SET status = 'completed', completed_at = ?1 WHERE id = ?2",
        params![&now, t_id],
    )?;

    // 3. Aggregate window_events between started_at and now
    let (_, focus_score, context_switches, apps) = compute_span_metrics(conn, &started_at, &now, Some(task_id))?;

    let apps_json = serde_json::to_string(&apps).unwrap_or_else(|_| "[]".to_string());
    let notes_val = notes.unwrap_or_default();

    // 4. Insert into focus_sessions
    conn.execute(
        "INSERT INTO focus_sessions (
            task_id, task_title, planned_seconds, actual_seconds, started_at, ended_at,
            context_switches, focus_score, app_breakdown_json, notes
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            t_id,
            title,
            planned_sec,
            actual_sec,
            started_at,
            now,
            context_switches,
            focus_score,
            apps_json,
            notes_val
        ],
    )?;

    let session_id = conn.last_insert_rowid();

    Ok(FocusSessionRecord {
        id: session_id,
        task_id: t_id,
        task_title: title,
        planned_seconds: planned_sec,
        actual_seconds: actual_sec,
        started_at,
        ended_at: now,
        context_switches,
        focus_score,
        apps,
        notes: Some(notes_val),
    })
    })();
    match result {
        Ok(record) => {
            conn.execute_batch("RELEASE finish_focus_session")?;
            Ok(Some(record))
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK TO finish_focus_session; RELEASE finish_focus_session");
            Err(error)
        }
    }
}

pub fn backfill_session_focus_scores(conn: &Connection) -> Result<usize> {
    let candidates: Vec<(i64, String, String, f64, i32, Option<i64>)> = {
        let mut stmt = conn.prepare(
            "SELECT id, started_at, ended_at, focus_score, context_switches, task_id FROM focus_sessions",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?))
        })?;
        rows.flatten().collect()
    };

    let mut updated = 0;
    for (id, started_at, ended_at, prev_score, prev_switches, task_id) in candidates {
        let (total_sec, score, switches, apps) = compute_span_metrics(conn, &started_at, &ended_at, task_id)?;
        if total_sec == 0 {
            continue;
        }
        if (score - prev_score).abs() < 0.05 && switches == prev_switches {
            continue;
        }
        let apps_json = serde_json::to_string(&apps).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE focus_sessions SET focus_score = ?1, context_switches = ?2, app_breakdown_json = ?3 WHERE id = ?4",
            params![score, switches, apps_json, id],
        )?;
        updated += 1;
    }

    Ok(updated)
}

pub fn get_completed_sessions(conn: &Connection, limit: usize) -> Result<Vec<FocusSessionRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, task_id, task_title, planned_seconds, actual_seconds, started_at, ended_at,
                context_switches, focus_score, app_breakdown_json, notes
         FROM focus_sessions
         ORDER BY id DESC LIMIT ?1",
    )?;

    let sessions = stmt
        .query_map(params![limit], |r| {
            let app_json: String = r.get(9).unwrap_or_else(|_| "[]".to_string());
            let apps: Vec<AppTimeUsage> = serde_json::from_str(&app_json).unwrap_or_default();
            Ok(FocusSessionRecord {
                id: r.get(0)?,
                task_id: r.get(1)?,
                task_title: r.get(2)?,
                planned_seconds: r.get(3)?,
                actual_seconds: r.get(4)?,
                started_at: r.get(5)?,
                ended_at: r.get(6)?,
                context_switches: r.get(7)?,
                focus_score: r.get(8)?,
                apps,
                notes: r.get(10).ok(),
            })
        })?
        .filter_map(Result::ok)
        .collect();

    Ok(sessions)
}

pub fn get_daily_history(conn: &Connection, days: i64) -> Result<Vec<DayHistoryItem>> {
    let now = chrono::Local::now();
    let start_date = now - chrono::Duration::days(days.saturating_sub(1));
    let start_date_str = start_date.format("%Y-%m-%d").to_string();

    let mut stmt = conn.prepare(
        "SELECT 
            substr(started_at, 1, 10) as day_date,
            SUM(duration_seconds) as total_sec,
            SUM(CASE WHEN productivity_score = 2 THEN duration_seconds ELSE 0 END) as deep_sec,
            SUM(CASE WHEN productivity_score >= 1 THEN duration_seconds ELSE 0 END) as prod_sec
         FROM window_events
         WHERE started_at >= ?1 AND is_afk = 0
         GROUP BY day_date",
    )?;

    use std::collections::HashMap;
    let mut day_data: HashMap<String, (i32, i32, i32)> = HashMap::new();
    let rows = stmt.query_map(params![start_date_str], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, i32>(1)?,
            r.get::<_, i32>(2)?,
            r.get::<_, i32>(3)?,
        ))
    })?;

    for row in rows.flatten() {
        day_data.insert(row.0, (row.1, row.2, row.3));
    }

    let mut session_counts: HashMap<String, i32> = HashMap::new();
    let mut s_stmt = conn.prepare(
        "SELECT substr(started_at, 1, 10) as s_date, COUNT(*) as count
         FROM focus_sessions
         WHERE started_at >= ?1
         GROUP BY s_date",
    )?;
    let s_rows = s_stmt.query_map(params![start_date_str], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i32>(1)?))
    })?;
    for r in s_rows.flatten() {
        session_counts.insert(r.0, r.1);
    }

    let mut history = Vec::new();
    for i in 0..days {
        let d = (start_date + chrono::Duration::days(i))
            .format("%Y-%m-%d")
            .to_string();
        let (total_sec, deep_sec, prod_sec) = day_data.get(&d).copied().unwrap_or((0, 0, 0));
        let session_count = session_counts.get(&d).copied().unwrap_or(0);
        let focus_score = if total_sec > 0 {
            ((prod_sec as f64) / (total_sec as f64)) * 100.0
        } else {
            100.0
        };

        history.push(DayHistoryItem {
            date: d,
            total_seconds: total_sec,
            deep_work_seconds: deep_sec,
            focus_score: (focus_score * 10.0).round() / 10.0,
            session_count,
        });
    }

    Ok(history)
}

pub fn get_day_detail(conn: &Connection, date: &str) -> Result<DayDetail> {
    let date_prefix = format!("{}%", date);
    let end_bound = format!("{}T23:59:59.999999999Z~", date);

    // 1. Top Apps (aggregated per app_name with dominant category)
    let (_, _, _, mut top_apps) = compute_span_metrics(conn, date, &end_bound, None)?;
    top_apps.truncate(8);

    // 2. Focus Sessions
    let mut sess_stmt = conn.prepare(
        "SELECT id, task_id, task_title, planned_seconds, actual_seconds, started_at, ended_at,
                context_switches, focus_score, app_breakdown_json, notes
         FROM focus_sessions
         WHERE started_at LIKE ?1
         ORDER BY id DESC",
    )?;

    let sessions = sess_stmt
        .query_map(params![&date_prefix], |r| {
            let app_json: String = r.get(9).unwrap_or_else(|_| "[]".to_string());
            let apps: Vec<AppTimeUsage> = serde_json::from_str(&app_json).unwrap_or_default();
            Ok(FocusSessionRecord {
                id: r.get(0)?,
                task_id: r.get(1)?,
                task_title: r.get(2)?,
                planned_seconds: r.get(3)?,
                actual_seconds: r.get(4)?,
                started_at: r.get(5)?,
                ended_at: r.get(6)?,
                context_switches: r.get(7)?,
                focus_score: r.get(8)?,
                apps,
                notes: r.get(10).ok(),
            })
        })?
        .filter_map(Result::ok)
        .collect();

    // 3. Day Summary
    let summary = compute_day_summary(conn, &date_prefix)?;

    // 4. Full day timeline events (newest-first, no 100-row cap)
    let mut time_stmt = conn.prepare(
        "SELECT id, app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk
         FROM window_events WHERE started_at LIKE ?1 ORDER BY id DESC",
    )?;
    let timeline = time_stmt
        .query_map(params![&date_prefix], |r| {
            Ok(WindowEvent {
                id: r.get(0)?,
                app_name: r.get(1)?,
                window_title: r.get(2)?,
                category: r.get(3)?,
                productivity_score: r.get(4)?,
                started_at: r.get(5)?,
                duration_seconds: r.get(6)?,
                is_afk: r.get(7)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();

    Ok(DayDetail {
        date: date.to_string(),
        summary,
        top_apps,
        sessions,
        timeline,
    })
}

pub fn export_day_markdown(conn: &Connection, date: &str) -> Result<String> {
    let detail = get_day_detail(conn, date)?;
    let deep_hours = (detail.summary.deep_work_seconds as f64) / 3600.0;
    let total_hours = (detail.summary.total_seconds as f64) / 3600.0;

    let mut md = format!("# 🧘 FlowState Daily Log — {}\n\n", detail.date);
    md.push_str(&format!(
        "- **Deep Work**: {:.1} hrs ({} mins)\n- **Total Active**: {:.1} hrs\n- **Focus Pulse**: {:.0}%\n- **Sessions Completed**: {}\n\n",
        deep_hours,
        detail.summary.deep_work_seconds / 60,
        total_hours,
        detail.summary.focus_score,
        detail.sessions.len()
    ));

    if !detail.sessions.is_empty() {
        md.push_str("### 🎯 Focus Sessions\n");
        for s in &detail.sessions {
            md.push_str(&format!(
                "- **{}** (Planned: {}m, Actual: {}m, Focus: {:.0}%)\n",
                s.task_title,
                s.planned_seconds / 60,
                s.actual_seconds / 60,
                s.focus_score
            ));
            if let Some(ref note) = s.notes {
                if !note.is_empty() {
                    md.push_str(&format!("  *Note: {}*\n", note));
                }
            }
        }
        md.push('\n');
    }

    if !detail.top_apps.is_empty() {
        md.push_str("### 📊 Top Applications\n");
        for a in &detail.top_apps {
            md.push_str(&format!(
                "- `{}`: {} mins ({:.0}%) — {}\n",
                a.app_name,
                a.duration_seconds / 60,
                a.percentage,
                a.category
            ));
        }
    }

    Ok(md)
}

pub fn parse_to_utc(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    // 1. Try RFC3339 / ISO8601 (handles Z, +08:00, -05:00, millis, etc.)
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&chrono::Utc));
    }

    // 2. Try naive ISO format YYYY-MM-DDTHH:MM:SS / YYYY-MM-DDTHH:MM
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") {
        return Some(chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(naive, chrono::Utc));
    }
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M") {
        return Some(chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(naive, chrono::Utc));
    }
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return Some(chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(naive, chrono::Utc));
    }

    None
}

pub fn normalize_to_utc_iso(s: &str) -> String {
    if let Some(dt) = parse_to_utc(s) {
        dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
    } else {
        s.to_string()
    }
}

pub fn create_alarm(
    conn: &Connection,
    title: &str,
    alarm_type: &str,
    trigger_at: &str,
    duration_seconds: i32,
    note_id: Option<i64>,
) -> Result<Alarm> {
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let norm_trigger = normalize_to_utc_iso(trigger_at);
    conn.execute(
        "INSERT INTO alarms (title, alarm_type, trigger_at, duration_seconds, note_id, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)",
        params![title, alarm_type, norm_trigger, duration_seconds, note_id, now],
    )?;
    let id = conn.last_insert_rowid();
    Ok(Alarm {
        id,
        title: title.to_string(),
        alarm_type: alarm_type.to_string(),
        trigger_at: norm_trigger,
        duration_seconds,
        note_id,
        status: "pending".to_string(),
        created_at: now,
    })
}

pub fn list_active_alarms(conn: &Connection) -> Result<Vec<Alarm>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, alarm_type, trigger_at, duration_seconds, note_id, status, created_at
         FROM alarms
         WHERE status IN ('pending', 'ringing')",
    )?;
    let mut rows: Vec<Alarm> = stmt.query_map([], row_to_alarm)?.filter_map(Result::ok).collect();
    rows.sort_by(|a, b| {
        let da = parse_to_utc(&a.trigger_at);
        let db = parse_to_utc(&b.trigger_at);
        da.cmp(&db)
    });
    Ok(rows)
}

pub fn list_all_recent_alarms(conn: &Connection) -> Result<Vec<Alarm>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, alarm_type, trigger_at, duration_seconds, note_id, status, created_at
         FROM alarms
         ORDER BY id DESC
         LIMIT 50",
    )?;
    let rows = stmt.query_map([], row_to_alarm)?.filter_map(Result::ok).collect();
    Ok(rows)
}

pub fn update_alarm_status(conn: &Connection, id: i64, status: &str, new_trigger_at: Option<&str>) -> Result<()> {
    if let Some(new_time) = new_trigger_at {
        let norm_new = normalize_to_utc_iso(new_time);
        conn.execute(
            "UPDATE alarms SET status = ?1, trigger_at = ?2 WHERE id = ?3",
            params![status, norm_new, id],
        )?;
    } else {
        conn.execute(
            "UPDATE alarms SET status = ?1 WHERE id = ?2",
            params![status, id],
        )?;
    }
    Ok(())
}

pub fn delete_alarm(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM alarms WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn check_due_alarms(conn: &Connection) -> Result<Vec<Alarm>> {
    if get_active_ringing_alarm(conn)?.is_some() {
        return Ok(Vec::new());
    }
    let now = chrono::Utc::now();
    let mut stmt = conn.prepare(
        "SELECT id, title, alarm_type, trigger_at, duration_seconds, note_id, status, created_at
         FROM alarms
         WHERE status = 'pending'",
    )?;
    let all_pending: Vec<Alarm> = stmt.query_map([], row_to_alarm)?.filter_map(Result::ok).collect();
    let mut due = Vec::new();

    for a in all_pending {
        if let Some(dt) = parse_to_utc(&a.trigger_at) {
            if dt <= now {
                conn.execute(
                    "UPDATE alarms SET status = 'ringing' WHERE id = ?1",
                    params![a.id],
                )?;
                let mut ringing_alarm = a;
                ringing_alarm.status = "ringing".to_string();
                due.push(ringing_alarm);
                break;
            }
        }
    }
    Ok(due)
}

pub fn get_upcoming_alarm_within(conn: &Connection, max_seconds_ahead: i64) -> Result<Option<Alarm>> {
    let now = chrono::Utc::now();
    let max_time = now + chrono::Duration::seconds(max_seconds_ahead);

    let mut stmt = conn.prepare(
        "SELECT id, title, alarm_type, trigger_at, duration_seconds, note_id, status, created_at
         FROM alarms
         WHERE status = 'pending'",
    )?;
    let all_pending: Vec<Alarm> = stmt.query_map([], row_to_alarm)?.filter_map(Result::ok).collect();

    let mut upcoming: Vec<(chrono::DateTime<chrono::Utc>, Alarm)> = Vec::new();
    for a in all_pending {
        if let Some(dt) = parse_to_utc(&a.trigger_at) {
            if dt > now && dt <= max_time {
                upcoming.push((dt, a));
            }
        }
    }

    upcoming.sort_by_key(|(dt, _)| *dt);
    Ok(upcoming.into_iter().next().map(|(_, a)| a))
}

pub fn get_active_timer(conn: &Connection) -> Result<Option<Alarm>> {
    let now = chrono::Utc::now();
    let mut stmt = conn.prepare(
        "SELECT id, title, alarm_type, trigger_at, duration_seconds, note_id, status, created_at
         FROM alarms
         WHERE alarm_type = 'timer' AND status = 'pending'",
    )?;
    let all_timers: Vec<Alarm> = stmt.query_map([], row_to_alarm)?.filter_map(Result::ok).collect();

    let mut upcoming: Vec<(chrono::DateTime<chrono::Utc>, Alarm)> = Vec::new();
    for a in all_timers {
        if let Some(dt) = parse_to_utc(&a.trigger_at) {
            if dt > now {
                upcoming.push((dt, a));
            }
        }
    }

    upcoming.sort_by_key(|(dt, _)| *dt);
    Ok(upcoming.into_iter().next().map(|(_, a)| a))
}

pub fn get_active_ringing_alarm(conn: &Connection) -> Result<Option<Alarm>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, alarm_type, trigger_at, duration_seconds, note_id, status, created_at
         FROM alarms
         WHERE status = 'ringing'
         ORDER BY id DESC
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map([], row_to_alarm)?;
    if let Some(first) = rows.next() {
        return Ok(Some(first?));
    }
    Ok(None)
}

pub fn row_to_alarm(r: &rusqlite::Row) -> Result<Alarm> {
    Ok(Alarm {
        id: r.get(0)?,
        title: r.get(1)?,
        alarm_type: r.get(2)?,
        trigger_at: r.get(3)?,
        duration_seconds: r.get(4)?,
        note_id: r.get(5)?,
        status: r.get(6)?,
        created_at: r.get(7)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restart_does_not_extend_old_interval() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let old = (chrono::Local::now() - chrono::Duration::hours(1)).to_rfc3339();
        conn.execute("INSERT INTO window_events (app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk) VALUES ('app', 'title', 'work', 2, ?1, 5, 0)", params![old]).unwrap();
        record_tick(&conn, "app", "title", "work", 2, false, 1).unwrap();
        assert_eq!(conn.query_row("SELECT count(*) FROM window_events", [], |r| r.get::<_, i32>(0)).unwrap(), 2);
    }

    #[test]
    fn initialization_preserves_user_classification() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn.execute("INSERT INTO window_events (app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk) VALUES ('browser', 'YouTube tutorial', 'My work', 2, '2026-01-01T12:00:00+00:00', 10, 0)", []).unwrap();
        init_db(&conn).unwrap();
        assert_eq!(conn.query_row("SELECT category FROM window_events", [], |r| r.get::<_, String>(0)).unwrap(), "My work");
    }

    #[test]
    fn completion_rolls_back_if_session_cannot_be_saved() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let task = create_task(&conn, "work", 60).unwrap();
        conn.execute_batch("CREATE TRIGGER fail_session BEFORE INSERT ON focus_sessions BEGIN SELECT RAISE(ABORT, 'failed'); END;").unwrap();
        assert!(finish_focus_session(&conn, task.id, None).is_err());
        assert_eq!(get_active_task(&conn).unwrap().unwrap().id, task.id);
    }

    #[test]
    fn session_score_excludes_pause() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn.execute("INSERT INTO window_events (app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk) VALUES ('work', '', 'work', 2, '2026-01-01T12:00:00+00:00', 10, 0), ('break', '', 'break', -2, '2026-01-01T12:00:10+00:00', 10, 0)", []).unwrap();
        conn.execute("INSERT INTO task_pauses VALUES (1, '2026-01-01T12:00:10+00:00', '2026-01-01T12:00:20+00:00')", []).unwrap();
        let (duration, score, _, _) = compute_span_metrics(&conn, "2026-01-01T12:00:00+00:00", "2026-01-01T12:00:20+00:00", Some(1)).unwrap();
        assert_eq!(duration, 10);
        assert_eq!(score, 100.0);
    }

    #[test]
    fn due_alarms_wait_for_current_alarm() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let first = create_alarm(&conn, "first", "alarm", "2020-01-01T00:00:00Z", 0, None).unwrap();
        let second = create_alarm(&conn, "second", "alarm", "2020-01-01T00:00:00Z", 0, None).unwrap();
        assert_eq!(check_due_alarms(&conn).unwrap()[0].id, first.id);
        assert!(check_due_alarms(&conn).unwrap().is_empty());
        update_alarm_status(&conn, first.id, "dismissed", None).unwrap();
        assert_eq!(check_due_alarms(&conn).unwrap()[0].id, second.id);
    }

    #[test]
    fn test_alarm_lifecycle() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        // 1. Create a timer due in 10 minutes (JS toISOString UTC format with 'Z')
        let future_utc = (chrono::Utc::now() + chrono::Duration::seconds(600)).to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let alarm = create_alarm(&conn, "Focus Sprint", "timer", &future_utc, 600, None).unwrap();
        assert_eq!(alarm.status, "pending");
        assert_eq!(alarm.title, "Focus Sprint");

        // 2. Create another future alarm with a local timezone offset format (+08:00)
        let future_offset = (chrono::Local::now() + chrono::Duration::seconds(1200)).to_rfc3339();
        let alarm2 = create_alarm(&conn, "Future Meeting", "alarm", &future_offset, 0, None).unwrap();
        assert_eq!(alarm2.status, "pending");

        // 3. Active timer query
        let active_tm = get_active_timer(&conn).unwrap();
        assert!(active_tm.is_some());
        assert_eq!(active_tm.unwrap().id, alarm.id);

        // 4. Imminent alarm query (within 300s should be None since both are >300s away)
        let imminent = get_upcoming_alarm_within(&conn, 300).unwrap();
        assert!(imminent.is_none());

        // 5. Create an alarm due right now (5 seconds in the past)
        let past_time = (chrono::Utc::now() - chrono::Duration::seconds(5)).to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let past_alarm = create_alarm(&conn, "Break Time", "alarm", &past_time, 0, Some(42)).unwrap();

        // 6. Check due alarms -> ONLY past_alarm rings, future alarms stay pending!
        let due = check_due_alarms(&conn).unwrap();
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].id, past_alarm.id);

        // 7. Ringing alarm query
        let ringing = get_active_ringing_alarm(&conn).unwrap();
        assert!(ringing.is_some());
        assert_eq!(ringing.unwrap().id, past_alarm.id);

        // 8. Update status to dismissed
        update_alarm_status(&conn, past_alarm.id, "dismissed", None).unwrap();
        let ringing_after = get_active_ringing_alarm(&conn).unwrap();
        assert!(ringing_after.is_none());

        // 9. Create an imminent alarm (2 minutes away)
        let imminent_time = (chrono::Utc::now() + chrono::Duration::seconds(120)).to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let imm_alarm = create_alarm(&conn, "Imminent Alert", "alarm", &imminent_time, 0, None).unwrap();
        let upcoming = get_upcoming_alarm_within(&conn, 300).unwrap();
        assert!(upcoming.is_some());
        assert_eq!(upcoming.unwrap().id, imm_alarm.id);
    }

    #[test]
    fn test_record_tick_midnight_boundary() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        conn.execute(
            "INSERT INTO window_events (app_name, window_title, category, productivity_score, started_at, duration_seconds, is_afk)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params!["Code", "src/db.rs", "Software Engineering", 2, "2026-10-17T23:59:50+08:00", 10, false],
        ).unwrap();

        record_tick(&conn, "Code", "src/db.rs", "Software Engineering", 2, false, 5).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM window_events", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_focus_session_starting_mid_window() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        record_tick(&conn, "Code", "src/db.rs", "Software Engineering", 2, false, 5).unwrap();

        let task = create_task(&conn, "Focus Test Task", 1500).unwrap();

        record_tick(&conn, "Code", "src/db.rs", "Software Engineering", 2, false, 5).unwrap();

        let session = finish_focus_session(&conn, task.id, None).unwrap().expect("session exists");

        assert!(!session.apps.is_empty());
        assert_eq!(session.apps[0].app_name, "Code");
    }
}
