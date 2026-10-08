mod database;
use database::{Database, Snapshot};
use serde_json::Value;
use std::sync::Mutex;
use tauri::Manager;
struct Storage(Mutex<Database>);
#[tauri::command]
fn desktop_load(state: tauri::State<'_, Storage>) -> Result<Snapshot, String> {
    state.0.lock().map_err(|_| "SQLite lock failed")?.load()
}
#[tauri::command]
fn desktop_save_comment(
    state: tauri::State<'_, Storage>,
    id: String,
    comment: Option<String>,
    color: Option<String>,
) -> Result<Value, String> {
    state
        .0
        .lock()
        .map_err(|_| "SQLite lock failed")?
        .comment(&id, comment, color)
}
#[tauri::command]
fn desktop_save_preference(
    state: tauri::State<'_, Storage>,
    key: String,
    value: Value,
) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "SQLite lock failed")?
        .preference(&key, value)
}
#[tauri::command]
fn desktop_record_view(state: tauri::State<'_, Storage>, id: String) -> Result<Value, String> {
    state.0.lock().map_err(|_| "SQLite lock failed")?.view(&id)
}
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = app.path().app_data_dir()?.join("tenderpro.sqlite");
            let database = Database::open(&path).map_err(std::io::Error::other)?;
            app.manage(Storage(Mutex::new(database)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_load,
            desktop_save_comment,
            desktop_save_preference,
            desktop_record_view
        ])
        .run(tauri::generate_context!())
        .expect("Tender PRO desktop startup failed");
}
