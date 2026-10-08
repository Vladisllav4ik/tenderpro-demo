use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
pub struct Database {
    pub connection: Connection,
    pub path: PathBuf,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub database_path: String,
    pub schema_version: i32,
    pub integrity: String,
}
#[derive(Serialize)]
pub struct Snapshot {
    pub tenders: Vec<Value>,
    pub preferences: serde_json::Map<String, Value>,
    pub diagnostics: Diagnostics,
}
fn at() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
impl Database {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut connection = Connection::open(path).map_err(|e| e.to_string())?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        connection
            .execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;")
            .map_err(|e| e.to_string())?;
        let version: i32 = connection
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if version > 1 {
            return Err("База створена новішою версією програми; downgrade заборонено.".into());
        }
        if version == 0 {
            let tx = connection.transaction().map_err(|e| e.to_string())?;
            tx.execute_batch(include_str!("../migrations/001_foundation.sql"))
                .map_err(|e| e.to_string())?;
            tx.commit().map_err(|e| e.to_string())?;
        }
        let mut db = Self {
            connection,
            path: path.to_path_buf(),
        };
        db.integrity()?;
        db.seed()?;
        Ok(db)
    }
    fn integrity(&self) -> Result<(), String> {
        let check: String = self
            .connection
            .query_row("PRAGMA integrity_check", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if check != "ok" {
            return Err("SQLite integrity check failed".into());
        }
        if self
            .connection
            .prepare("PRAGMA foreign_key_check")
            .map_err(|e| e.to_string())?
            .exists([])
            .map_err(|e| e.to_string())?
        {
            return Err("SQLite foreign key check failed".into());
        }
        Ok(())
    }
    fn seed(&mut self) -> Result<(), String> {
        let exists: bool = self
            .connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM tenders WHERE id='DESKTOP-POC-001')",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists {
            return Ok(());
        }
        let mut fixture: Value =
            serde_json::from_str(include_str!("../fixtures/desktop-tender.json"))
                .map_err(|e| e.to_string())?;
        fixture["publishedAt"] = json!(chrono::Utc::now().format("%Y-%m-%d").to_string());
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        let now = at();
        tx.execute(
            "INSERT INTO tenders(id,payload) VALUES(?1,?2)",
            params!["DESKTOP-POC-001", fixture.to_string()],
        )
        .map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO tender_sources(tender_id,source,external_id,raw_json) VALUES(?1,'desktop-demo',?1,?2)",params!["DESKTOP-POC-001",fixture.to_string()]).map_err(|e|e.to_string())?;
        tx.execute(
            "INSERT INTO comments(tender_id,updated_at) VALUES(?1,?2)",
            params!["DESKTOP-POC-001", now],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO statuses VALUES(?1,'NEW',?2)",
            params!["DESKTOP-POC-001", now],
        )
        .map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO history(tender_id,kind,text,at) VALUES(?1,'desktop.seed','Створено окремий демонстраційний запис Desktop POC',?2)",params!["DESKTOP-POC-001",now]).map_err(|e|e.to_string())?;
        tx.execute(
            "INSERT OR IGNORE INTO preferences VALUES('dateRange',?1,?2)",
            params![
                json!({"preset":"history","from":"","to":""}).to_string(),
                now
            ],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }
    pub fn tender(&self, id: &str) -> Result<Value, String> {
        let (payload,text,color,status):(String,String,String,String)=self.connection.query_row("SELECT t.payload,c.text,c.color,s.status FROM tenders t JOIN comments c ON c.tender_id=t.id JOIN statuses s ON s.tender_id=t.id WHERE t.id=?1",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).map_err(|_|"Тендер не знайдено.".to_string())?;
        let mut tender: Value = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
        tender["comment"] = json!(text);
        tender["commentText"] = json!(text);
        tender["commentColor"] = json!(color);
        tender["status"] = json!(status);
        let mut stmt = self
            .connection
            .prepare("SELECT kind,text,at FROM history WHERE tender_id=?1 ORDER BY id")
            .map_err(|e| e.to_string())?;
        let history=stmt.query_map([id],|r|Ok(json!({"kind":r.get::<_,String>(0)?,"text":r.get::<_,String>(1)?,"at":r.get::<_,String>(2)?}))).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
        tender["history"] = json!(history);
        Ok(tender)
    }
    pub fn load(&self) -> Result<Snapshot, String> {
        let ids = self
            .connection
            .prepare("SELECT id FROM tenders ORDER BY id")
            .map_err(|e| e.to_string())?
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        let tenders = ids
            .iter()
            .map(|id| self.tender(id))
            .collect::<Result<Vec<_>, _>>()?;
        let mut preferences = serde_json::Map::new();
        let rows = self
            .connection
            .prepare("SELECT key,value FROM preferences")
            .map_err(|e| e.to_string())?
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for (k, v) in rows {
            preferences.insert(k, serde_json::from_str(&v).map_err(|e| e.to_string())?);
        }
        Ok(Snapshot {
            tenders,
            preferences,
            diagnostics: Diagnostics {
                database_path: self.path.display().to_string(),
                schema_version: 1,
                integrity: "ok".into(),
            },
        })
    }
    pub fn comment(
        &mut self,
        id: &str,
        text: Option<String>,
        color: Option<String>,
    ) -> Result<Value, String> {
        if text.as_ref().is_some_and(|t| t.chars().count() > 30000) {
            return Err("Коментар перевищує 30000 символів.".into());
        }
        if color.as_ref().is_some_and(|c| {
            !matches!(
                c.as_str(),
                "none" | "yellow" | "green" | "red" | "blue" | "purple" | "gray"
            )
        }) {
            return Err("Некоректний колір.".into());
        }
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        let (old_text, old_color): (String, String) = tx
            .query_row(
                "SELECT text,color FROM comments WHERE tender_id=?1",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|_| "Тендер не знайдено.".to_string())?;
        let new_text = text.unwrap_or_else(|| old_text.clone());
        let new_color = color.unwrap_or_else(|| old_color.clone());
        let now = at();
        tx.execute("UPDATE comments SET text=?2,color=?3,revision=revision+1,updated_at=?4 WHERE tender_id=?1",params![id,new_text,new_color,now]).map_err(|e|e.to_string())?;
        tx.execute("UPDATE tenders SET revision=revision+1 WHERE id=?1", [id])
            .map_err(|e| e.to_string())?;
        if old_text != new_text {
            tx.execute(
                "INSERT INTO history(tender_id,kind,text,at) VALUES(?1,'comment',?2,?3)",
                params![id, format!("Коментар: {} → {}", old_text, new_text), now],
            )
            .map_err(|e| e.to_string())?;
        }
        if old_color != new_color {
            tx.execute(
                "INSERT INTO history(tender_id,kind,text,at) VALUES(?1,'comment-color',?2,?3)",
                params![
                    id,
                    format!("Колір коментаря: {} → {}", old_color, new_color),
                    now
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        self.tender(id)
    }
    pub fn preference(&mut self, key: &str, value: Value) -> Result<(), String> {
        if key.len() > 100 || key.is_empty() || value.to_string().len() > 100000 {
            return Err("Некоректні налаштування.".into());
        }
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO preferences VALUES(?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",params![key,value.to_string(),at()]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }
    pub fn view(&mut self, id: &str) -> Result<Value, String> {
        let mut t = self.tender(id)?;
        if t["firstViewedAt"].is_string() {
            return Ok(t);
        }
        let now = at();
        t["firstViewedAt"] = json!(now);
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE tenders SET payload=?2,revision=revision+1 WHERE id=?1",
            params![id, t.to_string()],
        )
        .map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO history(tender_id,kind,text,at) VALUES(?1,'view','Перший перегляд картки',?2)",params![id,now]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        self.tender(id)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn file(label: &str) -> PathBuf {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("_temp/other/sqlite-tests")
            .join(format!(
                "{}-{}-{}.sqlite",
                label,
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
        path
    }
    #[test]
    fn restart_preserves_comment_color_history_and_preferences() {
        let path = file("restart");
        {
            let mut db = Database::open(&path).unwrap();
            db.comment(
                "DESKTOP-POC-001",
                Some("Український коментар після restart".into()),
                Some("yellow".into()),
            )
            .unwrap();
            db.preference("zoom", json!(150)).unwrap();
            db.view("DESKTOP-POC-001").unwrap();
        }
        let db = Database::open(&path).unwrap();
        let s = db.load().unwrap();
        assert_eq!(s.tenders.len(), 1);
        assert_eq!(
            s.tenders[0]["commentText"],
            "Український коментар після restart"
        );
        assert_eq!(s.tenders[0]["commentColor"], "yellow");
        assert_eq!(s.preferences["zoom"], 150);
        assert_eq!(s.tenders[0]["history"].as_array().unwrap().len(), 4);
        assert!(s.tenders[0]["firstViewedAt"].is_string());
    }
    #[test]
    fn invalid_write_does_not_modify_data() {
        let mut db = Database::open(&file("invalid")).unwrap();
        assert!(db
            .comment(
                "DESKTOP-POC-001",
                Some("must rollback".into()),
                Some("invalid".into())
            )
            .is_err());
        assert_eq!(db.tender("DESKTOP-POC-001").unwrap()["commentText"], "");
        assert!(db.comment("missing", Some("x".into()), None).is_err());
        assert!(db
            .connection
            .execute(
                "INSERT INTO comments VALUES('missing','','none',0,'now')",
                []
            )
            .is_err());
    }
    #[test]
    fn newer_schema_is_rejected() {
        let path = file("future");
        {
            let db = Database::open(&path).unwrap();
            db.connection
                .pragma_update(None, "user_version", 2)
                .unwrap();
        }
        assert!(Database::open(&path).is_err());
    }
}
