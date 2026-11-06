use base64::Engine;
use image::{DynamicImage, ImageFormat, RgbaImage};
use serde::Serialize;
use std::io::Cursor;
use std::sync::Mutex;

// Frame captured when the snip starts. The overlay shows this frame and the
// selection is cropped from it, so the crop matches exactly what the user saw.
pub struct SnipFrame(pub Mutex<Option<RgbaImage>>);

// Label of the window that requested the snip ("overlay" pill or "main" dashboard).
pub struct SnipOrigin(pub Mutex<String>);

#[derive(Debug, Clone, Serialize)]
pub struct SnipStart {
    pub width: u32,
    pub height: u32,
    pub image_b64: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SnipResult {
    pub path: String,
    pub image_b64: String,
    pub width: u32,
    pub height: u32,
}

fn encode_png(img: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut buf = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(img.clone())
        .write_to(&mut buf, ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(buf.into_inner())
}

// Captures the monitor under the cursor (falls back to primary, then first).
pub fn capture_frame() -> Result<RgbaImage, String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    if monitors.is_empty() {
        return Err("No monitor found".into());
    }
    #[cfg(windows)]
    if let Some((x, y)) = cursor_pos() {
        if let Ok(m) = xcap::Monitor::from_point(x, y) {
            return m.capture_image().map_err(|e| e.to_string());
        }
    }
    let monitor = monitors
        .iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| monitors.first())
        .ok_or("No monitor found")?;
    monitor.capture_image().map_err(|e| e.to_string())
}

#[cfg(windows)]
fn cursor_pos() -> Option<(i32, i32)> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
    unsafe {
        let mut pt = POINT { x: 0, y: 0 };
        GetCursorPos(&mut pt).ok()?;
        Some((pt.x, pt.y))
    }
}

// Crops a selection (in frame pixels) out of the captured frame.
pub fn crop(frame: &RgbaImage, x: u32, y: u32, w: u32, h: u32) -> Result<RgbaImage, String> {
    if w == 0 || h == 0 {
        return Err("Selection is empty".into());
    }
    if x.saturating_add(w) > frame.width() || y.saturating_add(h) > frame.height() {
        return Err("Selection is outside the captured screen".into());
    }
    Ok(image::imageops::crop_imm(frame, x, y, w, h).to_image())
}

pub fn start_frame_b64(frame: &RgbaImage) -> Result<String, String> {
    let png = encode_png(frame)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(png))
}

// Writes the cropped PNG to disk and returns its path plus base64 for /note-analyze.
pub fn save_crop(img: &RgbaImage) -> Result<SnipResult, String> {
    let png = encode_png(img)?;
    let name = format!("snip-{}.png", chrono::Local::now().format("%Y%m%d-%H%M%S-%3f"));
    let path = crate::notes::snips_dir().join(name);
    std::fs::write(&path, &png).map_err(|e| e.to_string())?;
    Ok(SnipResult {
        path: path.to_string_lossy().into_owned(),
        image_b64: base64::engine::general_purpose::STANDARD.encode(&png),
        width: img.width(),
        height: img.height(),
    })
}

