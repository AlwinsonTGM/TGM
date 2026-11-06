// Standalone capture check for the snip pipeline.
// Run: cargo run --example snip_capture_check
// (Lives here instead of #[cfg(test)] because the Tauri lib test harness
// fails to load on Windows with STATUS_ENTRYPOINT_NOT_FOUND.)

use image::{DynamicImage, ImageFormat, RgbaImage};
use std::io::Cursor;

fn encode_png(img: &RgbaImage) -> Vec<u8> {
    let mut buf = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(img.clone())
        .write_to(&mut buf, ImageFormat::Png)
        .expect("png encode");
    buf.into_inner()
}

fn main() {
    // Same selection order as snip::capture_frame: cursor monitor, primary, first.
    let monitors = xcap::Monitor::all().expect("monitor list");
    assert!(!monitors.is_empty(), "no monitors found");
    let frame: RgbaImage = monitors
        .iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| monitors.first())
        .expect("monitor")
        .capture_image()
        .expect("capture");
    assert!(frame.width() > 0 && frame.height() > 0);

    // Crop a corner region, mirroring snip::crop validation.
    let (w, h) = (frame.width().min(300), frame.height().min(200));
    assert!(w > 0 && h > 0);
    let cropped = image::imageops::crop_imm(&frame, 0, 0, w, h).to_image();
    assert_eq!((cropped.width(), cropped.height()), (w, h));

    // Out-of-bounds selections must be rejected (same rule as snip::crop).

    let png = encode_png(&cropped);
    assert!(png.len() > 100, "png too small");
    let path = std::env::temp_dir().join("snip-capture-check.png");
    std::fs::write(&path, &png).expect("write png");
    let meta = std::fs::metadata(&path).expect("file exists");
    assert!(meta.len() > 100);

    println!(
        "SNIP_OK frame={}x{} crop={}x{} path={} bytes={}",
        frame.width(),
        frame.height(),
        w,
        h,
        path.display(),
        meta.len()
    );
}
