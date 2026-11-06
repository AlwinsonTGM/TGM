// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PANIC: {:?}\nBacktrace:\n{:?}", info, std::backtrace::Backtrace::capture());
        let _ = std::fs::write(tauri_app_lib::get_app_dir().join("crash.log"), msg);
    }));

    // Windows WebView2 transparency: force default background to 0x00000000 (fully transparent)
    std::env::set_var("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0");
    tauri_app_lib::run()
}
