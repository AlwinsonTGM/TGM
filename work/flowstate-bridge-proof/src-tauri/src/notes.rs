use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

// kind: "quick_thought" | "bug" | "feature" | "todo"
// project_id NULL = general (not tied to a project)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: i64,
    pub kind: String,
    pub text: String,
    pub project_id: Option<i64>,
    pub done: bool,
    pub pinned: bool,
    pub image_path: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

// Snips are saved under %LOCALAPPDATA%/FlowState/snips so screenshot notes survive restarts.
pub fn snips_dir() -> std::path::PathBuf {
    let mut p = crate::db::get_db_path();
    p.pop();
    p.push("snips");
    std::fs::create_dir_all(&p).ok();
    p
}

pub fn init_notes(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS projects (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             name TEXT NOT NULL,
             created_at TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS notes (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             kind TEXT NOT NULL,
             text TEXT NOT NULL,
             project_id INTEGER,
             done INTEGER NOT NULL DEFAULT 0,
             pinned INTEGER NOT NULL DEFAULT 0,
             image_path TEXT,
             embedding TEXT,
             created_at TEXT NOT NULL,
             updated_at TEXT
         );",
    )?;
    // Migration: add pinned column if older database exists
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN updated_at TEXT", []);
    Ok(())
}

pub fn add_note(
    conn: &Connection,
    kind: &str,
    text: &str,
    project_id: Option<i64>,
    image_path: Option<&str>,
    embedding: &[f32],
) -> Result<Note> {
    let now = chrono::Local::now().to_rfc3339();
    let emb = serde_json::to_string(embedding).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "INSERT INTO notes (kind, text, project_id, done, pinned, image_path, embedding, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7)",
        params![kind, text, project_id, image_path, emb, now, now],
    )?;
    Ok(Note {
        id: conn.last_insert_rowid(),
        kind: kind.into(),
        text: text.into(),
        project_id,
        done: false,
        pinned: false,
        image_path: image_path.map(String::from),
        created_at: now.clone(),
        updated_at: Some(now),
    })
}

// scope: None = all notes, Some(None) = general (no project), Some(Some(id)) = one project.
// mode 0 = all notes, 1 = general (project_id IS NULL), 2 = one project (project_id = ?2)
pub fn list_notes(conn: &Connection, mode: i64, project_id: Option<i64>, kind: Option<&str>) -> Result<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT id, kind, text, project_id, done, pinned, image_path, created_at, updated_at FROM notes
         WHERE (?1 = 0
                OR (?1 = 1 AND project_id IS NULL)
                OR (?1 = 2 AND project_id = ?2))
           AND (?3 IS NULL OR kind = ?3)
         ORDER BY pinned DESC, done ASC, id DESC",
    )?;
    let rows = stmt
        .query_map(params![mode, project_id, kind], row_to_note)?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

fn row_to_note(r: &rusqlite::Row) -> Result<Note> {
    Ok(Note {
        id: r.get(0)?,
        kind: r.get(1)?,
        text: r.get(2)?,
        project_id: r.get(3)?,
        done: r.get::<_, i64>(4)? != 0,
        pinned: r.get::<_, Option<i64>>(5)?.unwrap_or(0) != 0,
        image_path: r.get(6)?,
        created_at: r.get(7)?,
        updated_at: r.get(8)?,
    })
}

pub fn set_done(conn: &Connection, id: i64, done: bool) -> Result<()> {
    conn.execute("UPDATE notes SET done = ?1 WHERE id = ?2", params![done as i64, id])?;
    Ok(())
}

pub fn set_pinned(conn: &Connection, id: i64, pinned: bool) -> Result<()> {
    conn.execute("UPDATE notes SET pinned = ?1 WHERE id = ?2", params![pinned as i64, id])?;
    Ok(())
}

pub fn delete_note(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM alarms WHERE note_id = ?1", params![id]).ok();
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn update_note(conn: &Connection, id: i64, text: &str, kind: Option<&str>, project_id: Option<i64>) -> Result<()> {
    let now = chrono::Local::now().to_rfc3339();
    if let Some(k) = kind {
        conn.execute(
            "UPDATE notes SET text = ?1, kind = ?2, project_id = ?3, updated_at = ?4 WHERE id = ?5",
            params![text, k, project_id, now, id],
        )?;
    } else {
        conn.execute(
            "UPDATE notes SET text = ?1, project_id = ?2, updated_at = ?3 WHERE id = ?4",
            params![text, project_id, now, id],
        )?;
    }
    Ok(())
}

pub fn add_project(conn: &Connection, name: &str) -> Result<Project> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute("INSERT INTO projects (name, created_at) VALUES (?1, ?2)", params![name, now])?;
    Ok(Project { id: conn.last_insert_rowid(), name: name.into(), created_at: now })
}

pub fn list_projects(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare("SELECT id, name, created_at FROM projects ORDER BY id ASC")?;
    let rows = stmt
        .query_map([], |r| Ok(Project { id: r.get(0)?, name: r.get(1)?, created_at: r.get(2)? }))?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

// All notes with stored embeddings, for AI ranking.
pub fn notes_with_embeddings(conn: &Connection) -> Result<Vec<(Note, Vec<f32>)>> {
    let mut stmt = conn.prepare(
        "SELECT id, kind, text, project_id, done, pinned, image_path, created_at, updated_at, embedding FROM notes WHERE embedding IS NOT NULL",
    )?;
    let rows = stmt
        .query_map([], |r| {
            let note = row_to_note(r)?;
            let emb_json: String = r.get(9)?;
            let emb: Vec<f32> = serde_json::from_str(&emb_json).unwrap_or_default();
            Ok((note, emb))
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

