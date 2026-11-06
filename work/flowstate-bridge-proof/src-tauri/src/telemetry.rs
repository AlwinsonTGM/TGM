use crate::db::Rule;
use regex::Regex;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;

#[cfg(windows)]
use windows::Win32::Foundation::{CloseHandle, HWND};
#[cfg(windows)]
use windows::Win32::System::SystemInformation::GetTickCount;
#[cfg(windows)]
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
};

#[derive(Debug, Clone)]
pub struct ActiveWindowInfo {
    pub app_name: String,
    pub window_title: String,
    pub category: String,
    pub productivity_score: i32,
    pub is_afk: bool,
}

#[cfg(windows)]
pub fn get_idle_seconds() -> u32 {
    unsafe {
        let mut lii = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut lii).as_bool() {
            let uptime = GetTickCount();
            return (uptime.saturating_sub(lii.dwTime)) / 1000;
        }
        0
    }
}

#[cfg(not(windows))]
pub fn get_idle_seconds() -> u32 {
    0
}

#[cfg(windows)]
pub fn get_active_window_details() -> (String, String) {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0.is_null() {
            return ("Desktop".to_string(), "Desktop / Idle".to_string());
        }

        // Get Window Title
        let mut title_buf: [u16; 512] = [0; 512];
        let len = GetWindowTextW(hwnd, &mut title_buf);
        let title = if len > 0 {
            OsString::from_wide(&title_buf[..len as usize])
                .to_string_lossy()
                .into_owned()
        } else {
            "Untitled Window".to_string()
        };

        // Get Process Name
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));

        let app_name = if process_id > 0 {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) {
                let mut path_buf: [u16; 1024] = [0; 1024];
                let mut size: u32 = path_buf.len() as u32;
                let result = QueryFullProcessImageNameW(
                    handle,
                    PROCESS_NAME_WIN32,
                    windows::core::PWSTR(path_buf.as_mut_ptr()),
                    &mut size,
                )
                .is_ok();
                let _ = CloseHandle(handle);
                if result {
                    let full_path = OsString::from_wide(&path_buf[..size as usize])
                        .to_string_lossy()
                        .into_owned();
                    Path::new(&full_path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown.exe")
                        .to_string()
                } else {
                    "unknown.exe".to_string()
                }
            } else {
                "system.exe".to_string()
            }
        } else {
            "system.exe".to_string()
        };

        (app_name, title)
    }
}

#[cfg(not(windows))]
pub fn get_active_window_details() -> (String, String) {
    ("mock_editor.exe".to_string(), "App.tsx - Project".to_string())
}

#[allow(dead_code)]
pub fn categorize(app_name: &str, window_title: &str, rules: &[Rule]) -> (String, i32) {
    for rule in rules {
        if let Ok(re) = Regex::new(&rule.pattern) {
            match rule.match_type.as_str() {
                "app_regex" => {
                    if re.is_match(app_name) {
                        return (rule.category.clone(), rule.productivity_score);
                    }
                }
                "title_regex" => {
                    if re.is_match(window_title) {
                        return (rule.category.clone(), rule.productivity_score);
                    }
                }
                _ => {}
            }
        }
    }

    // Default smart heuristics if no custom rule matched
    let lower_app = app_name.to_lowercase();
    let lower_title = window_title.to_lowercase();

    deterministic_categorize(&lower_app, &lower_title)
        .unwrap_or_else(|| ("System Utilities & Files".to_string(), 0))
}

pub fn deterministic_categorize(lower_app: &str, lower_title: &str) -> Option<(String, i32)> {
    // 1. Productivity & Tracking (+2) — only FlowState itself
    if lower_app.contains("flowstate") || lower_title.contains("flowstate") || lower_title.contains("flowpill") {
        return Some(("Productivity & Tracking".to_string(), 2));
    }

    // 2. Gaming & Entertainment (-2)
    if lower_app.contains("roblox")
        || lower_title.contains("roblox")
        || lower_app.contains("minecraft")
        || lower_title.contains("minecraft")
        || lower_app.contains("steam")
        || lower_app.contains("epicgames")
        || lower_app.contains("riotclient")
        || lower_app.contains("valorant")
        || lower_app.contains("genshin")
        || lower_app.contains("fortnite")
        || lower_app.contains("overwatch")
    {
        return Some(("Gaming & Leisure".to_string(), -2));
    }

    // 3. Video, Music & Social Distractions (-2) — check before generic dev/title keywords
    // Special guard: anime.js / animejs is animation library development (+2), not video streaming
    if lower_title.contains("anime.js") || lower_title.contains("animejs") {
        return Some(("Software Engineering".to_string(), 2));
    }

    if lower_title.contains("youtube")
        || lower_title.contains("spotify")
        || lower_app.contains("spotify")
        || lower_title.contains("twitch")
        || lower_title.contains("netflix")
        || (lower_title.contains("anime") && !lower_title.contains("anime.js") && !lower_title.contains("animejs"))
        || lower_title.contains("prime video")
        || lower_title.contains("soundcloud")
        || lower_app.contains("vlc")
    {
        return Some(("Video & Media Streaming".to_string(), -2));
    }

    if lower_title.contains("reddit")
        || lower_title.contains("twitter")
        || lower_title.contains("x.com")
        || lower_title.contains("facebook")
        || lower_title.contains("instagram")
        || lower_title.contains("tiktok")
    {
        return Some(("Social Media & Feeds".to_string(), -2));
    }

    // 4. Team & Social Communication (-1)
    if lower_app.contains("slack")
        || lower_app.contains("teams")
        || lower_app.contains("discord")
        || lower_app.contains("telegram")
        || lower_app.contains("viber")
        || lower_app.contains("whatsapp")
        || lower_app.contains("signal")
        || lower_title.contains("| messenger")
        || lower_title.contains("messenger —")
        || lower_title.contains("slack")
        || lower_title.contains("discord")
        || lower_title.contains("microsoft teams")
    {
        return Some(("Team Communication".to_string(), -1));
    }

    if lower_app.contains("zoom") || lower_title.contains("google meet") {
        return Some(("Meetings & Video Calls".to_string(), -1));
    }

    // 5. Prediction markets / Finance (0 Neutral — never +2 Deep Work)
    if lower_title.contains("polymarket") || lower_title.contains("binance") || lower_title.contains("tradingview") {
        return Some(("Finance & Admin Operations".to_string(), 0));
    }

    // 6. AI & Prompt Engineering (+2)
    if lower_app.contains("chatgpt")
        || lower_app.contains("claude")
        || lower_app.contains("qwen")
        || lower_title.contains("chatgpt")
        || lower_title.contains("google gemini")
        || lower_title.contains("claude")
        || lower_title.contains("qwen")
    {
        return Some(("AI & Prompt Engineering".to_string(), 2));
    }

    // 7. Coding & Deep Dev (+2)
    if lower_app.contains("antigravity")
        || lower_app.contains("tauri-app")
        || lower_app.contains("opencode")
        || lower_app.contains("code")
        || lower_app.contains("cursor")
        || lower_app.contains("idea")
        || lower_app.contains("pycharm")
        || lower_app.contains("webstorm")
        || lower_app.contains("rider")
        || lower_app.contains("clion")
        || lower_app.contains("zed")
        || lower_app.contains("sublime")
        || lower_app.contains("notepad++")
        || lower_app.contains("nvim")
        || lower_app.contains("neovim")
        || lower_app.contains("terminal")
        || lower_app.contains("wezterm")
        || lower_app.contains("alacritty")
        || lower_app.contains("powershell")
        || lower_app.contains("cmd.exe")
        || lower_app == "cmd"
        || lower_app.contains("bash")
        || lower_title.contains("visual studio code")
        || lower_title.contains("cursor")
        || lower_title.contains("antigravity")
        || lower_title.contains("anime.js")
        || lower_title.contains("animejs")
        || lower_title.contains(".tsx")
        || lower_title.ends_with(".ts")
        || lower_title.contains(".ts ")
        || lower_title.contains(".ts -")
        || lower_title.contains(".ts:")
        || lower_title.contains(".ts]")
        || lower_title.contains(".rs")
        || lower_title.contains(".py")
        || lower_title.contains(".js")
        || lower_title.contains(".html")
        || lower_title.contains(".css")
        || lower_title.contains(".json")
    {
        return Some(("Software Engineering".to_string(), 2));
    }

    // 8. Writing & Knowledge Base (+1)
    if lower_app.contains("obsidian") || lower_title.contains("obsidian") || lower_app.contains("notion") || lower_title.contains("notion") {
        return Some(("Writing & Knowledge Base".to_string(), 1));
    }

    // 9. Knowledge & Technical Research (+1)
    if lower_title.contains("github")
        || lower_title.contains("stackoverflow")
        || lower_title.contains("crates.io")
        || lower_title.contains("docs.rs")
        || lower_title.contains("npmjs")
        || lower_title.contains("developer.mozilla")
        || lower_title.contains("linear.app")
        || lower_title.contains("devdocs")
        || lower_title.contains("localhost")
        || lower_title.contains("127.0.0.1")
        || lower_title.contains("visualizer")
    {
        return Some(("Research & Documentation".to_string(), 1));
    }

    // 10. OS Shells & Generic Empty Titles (0 Neutral)
    if lower_app == "explorer.exe"
        || lower_app == "shellexperiencehost.exe"
        || lower_app == "shellhost.exe"
        || lower_app == "searchhost.exe"
        || lower_app == "applicationframehost.exe"
        || lower_app == "dllhost.exe"
        || lower_app == "sharex.exe"
        || lower_app == "photos.exe"
        || lower_title == "mozilla firefox"
        || lower_title == "untitled window"
        || lower_title == "desktop / idle"
    {
        return Some(("System Utilities & Files".to_string(), 0));
    }

    None
}

#[derive(serde::Deserialize)]
struct AiClassifyResponse {
    category: String,
    productivity_score: i32,
}

pub fn ensure_classifier_daemon() {
    // Check if :8105 is already alive
    if ureq::get("http://127.0.0.1:8105/health")
        .timeout(std::time::Duration::from_millis(300))
        .call()
        .is_ok()
    {
        return;
    }

    let py_path = std::env::var("FLOWSTATE_PYTHON")
        .ok()
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| {
            let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string());
            let default_py = format!(r"{}\laya-service\.venv\Scripts\python.exe", user_profile);
            if std::path::Path::new(&default_py).exists() {
                default_py
            } else {
                "python".to_string()
            }
        });

    let script_candidate = if std::path::Path::new("src-tauri/classifier.py").exists() {
        std::path::PathBuf::from("src-tauri/classifier.py")
    } else if std::path::Path::new("classifier.py").exists() {
        std::path::PathBuf::from("classifier.py")
    } else if let Ok(exe) = std::env::current_exe() {
        exe.parent().map(|p| p.join("classifier.py")).unwrap_or_else(|| std::path::PathBuf::from("classifier.py"))
    } else {
        crate::db::get_app_dir().join("classifier.py")
    };

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(crate::db::get_app_dir().join("classifier.log"));

        let mut cmd = std::process::Command::new(py_path);
        cmd.arg("-u").arg(script_candidate).creation_flags(CREATE_NO_WINDOW);

        if let Ok(file) = log_file {
            if let Ok(err_file) = file.try_clone() {
                cmd.stdout(std::process::Stdio::from(file));
                cmd.stderr(std::process::Stdio::from(err_file));
            }
        }

        let _ = cmd.spawn();
    }
}

pub fn classify_with_ai(app_name: &str, window_title: &str) -> Option<(String, i32)> {
    let payload = serde_json::json!({
        "app": app_name,
        "title": window_title,
    });

    let res = ureq::post("http://127.0.0.1:8105/classify")
        .timeout(std::time::Duration::from_millis(600))
        .send_json(payload)
        .ok()?;

    let data: AiClassifyResponse = res.into_json().ok()?;
    // Guard: only FlowState itself should ever be classified as Productivity & Tracking (+2)
    if data.category == "Productivity & Tracking" {
        return Some(("System Utilities & Files".to_string(), 0));
    }
    Some((data.category, data.productivity_score))
}

pub fn poll_active_window(rules: &[Rule]) -> ActiveWindowInfo {
    let idle_sec = get_idle_seconds();
    let is_afk = idle_sec >= 300; // 5-minute AFK threshold

    let (app_name, window_title) = get_active_window_details();

    let lower_app = app_name.to_lowercase();
    let lower_title = window_title.to_lowercase();

    // 1. Keep self-app check first (never misclassify FlowState itself)
    let (category, productivity_score) = if lower_app.contains("flowstate")
        || lower_title.contains("flowstate")
        || lower_title.contains("flowpill")
    {
        ("Productivity & Tracking".to_string(), 2)
    } else if let Some(rule_match) = match_custom_rules(&app_name, &window_title, rules) {
        // 2. User-configured custom regex rules override default heuristics
        rule_match
    } else if let Some(det) = deterministic_categorize(&lower_app, &lower_title) {
        // 3. High-priority deterministic rules (Instant 0ms latency heuristics)
        det
    } else if let Some(ai_result) = classify_with_ai(&app_name, &window_title) {
        // 4. High-resolution local neural embedding classifier (EmbeddingGemma-2 on :8105)
        ai_result
    } else {
        ("System Utilities & Files".to_string(), 0)
    };

    ActiveWindowInfo {
        app_name,
        window_title,
        category,
        productivity_score,
        is_afk,
    }
}

fn match_custom_rules(app_name: &str, window_title: &str, rules: &[Rule]) -> Option<(String, i32)> {
    for rule in rules {
        if let Ok(re) = Regex::new(&rule.pattern) {
            match rule.match_type.as_str() {
                "app_regex" if re.is_match(app_name) => {
                    return Some((rule.category.clone(), rule.productivity_score));
                }
                "title_regex" if re.is_match(window_title) => {
                    return Some((rule.category.clone(), rule.productivity_score));
                }
                _ => {}
            }
        }
    }
    None
}

