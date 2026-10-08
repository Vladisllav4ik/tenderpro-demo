mod database;
mod sync;
use database::{Database, Snapshot};
use serde_json::Value;
use std::sync::Mutex;
use tauri::Manager;
struct Storage(Mutex<Database>);
struct SyncBusy(std::sync::atomic::AtomicBool);
#[tauri::command]
async fn desktop_sync(app: tauri::AppHandle) -> Result<sync::Report, String> {
    use std::sync::atomic::Ordering;
    let busy = app.state::<SyncBusy>();
    if busy.0.swap(true, Ordering::SeqCst) {
        return Err("Синхронізація вже виконується.".into());
    }
    let task_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let path = task_app
            .path()
            .app_data_dir()
            .map_err(|_| "AppData unavailable")?
            .join("sync-config.json");
        sync::download(&path, &task_app.state::<Storage>().0)
    })
    .await;
    busy.0.store(false, Ordering::SeqCst);
    result.map_err(|_| "Native sync task failed".to_string())?
}
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
            app.manage(SyncBusy(std::sync::atomic::AtomicBool::new(false)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_load,
            desktop_save_comment,
            desktop_save_preference,
            desktop_record_view,
            desktop_sync
        ])
        .run(tauri::generate_context!())
        .expect("Tender PRO desktop startup failed");
}
