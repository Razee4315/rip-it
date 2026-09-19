use log::info;
use std::env;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}! Ready to RIP IT!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "android")]
    {
        android_logger::init_once(
            android_logger::Config::default()
                .with_max_level(log::LevelFilter::Debug)
                .with_tag("RipIt"),
        );
    }

    #[cfg(not(target_os = "android"))]
    {
        let log_level = env::var("RUST_LOG")
            .ok()
            .and_then(|s| s.parse::<log::LevelFilter>().ok())
            .unwrap_or(log::LevelFilter::Info);
        let _ = simple_logger::SimpleLogger::new()
            .with_level(log_level)
            .init();
    }

    info!("Starting RIP IT!");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
