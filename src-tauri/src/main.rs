// Hide the console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Work around blank WebKitGTK window / WebGL issues on NVIDIA + Wayland compositors
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
            && std::env::var_os("WAYLAND_DISPLAY").is_some()
            && std::path::Path::new("/proc/driver/nvidia/version").exists()
        {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }
    kaizerhud_lib::run()
}
