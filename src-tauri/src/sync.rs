use crate::database::Database;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    io::Read,
    path::Path,
    time::{Duration, Instant},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Config {
    base_url: String,
    token: String,
    client_id: String,
    #[serde(default)]
    allow_local_http: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Page {
    pub version: u32,
    pub records: Vec<Value>,
    pub cursor: String,
    pub has_more: bool,
}
#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub received: usize,
    pub changed: usize,
    pub pages: usize,
    pub has_more: bool,
}

fn validate(record: &Value) -> Result<(), String> {
    let fail = || "Некоректний Tender DTO; сторінку не записано.".to_string();
    if record["version"] != 1 || record["source"] != "prozorro" {
        return Err(fail());
    }
    let id = record["id"].as_str().ok_or_else(fail)?;
    let revision = record["revision"].as_str().ok_or_else(fail)?;
    if id.len() != 32
        || !id.bytes().all(|b| b.is_ascii_hexdigit())
        || revision.len() != 64
        || !revision.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err(fail());
    }
    let public = record["publicId"].as_str().ok_or_else(fail)?;
    if !public.starts_with("UA-")
        || !public.is_ascii()
        || public.split('-').count() != 6
        || public
            .split('-')
            .skip(1)
            .take(4)
            .any(|part| part.is_empty() || !part.bytes().all(|b| b.is_ascii_digit()))
        || !public
            .rsplit('-')
            .next()
            .is_some_and(|part| part.len() == 1 && part.bytes().all(|b| b.is_ascii_lowercase()))
        || public.len() > 64
        || chrono::DateTime::parse_from_rfc3339(record["dateModified"].as_str().ok_or_else(fail)?)
            .is_err()
    {
        return Err(fail());
    }
    for key in ["title", "customer"] {
        if !record[key].is_null() && !record[key].is_string() {
            return Err(fail());
        }
    }
    for key in ["items", "documents", "cpv"] {
        if !record[key].is_array() {
            return Err(fail());
        }
    }
    if record["cpv"].as_array().unwrap().iter().any(|v| {
        let s = v.as_str().unwrap_or("");
        s.len() != 10
            || !s.as_bytes().iter().take(8).all(|b| b.is_ascii_digit())
            || s.as_bytes().get(8) != Some(&b'-')
            || !s.as_bytes().get(9).is_some_and(|b| b.is_ascii_digit())
    }) {
        return Err(fail());
    }
    for key in ["publishedAt", "submissionEnd"] {
        if !record[key].is_null()
            && chrono::DateTime::parse_from_rfc3339(record[key].as_str().ok_or_else(fail)?).is_err()
        {
            return Err(fail());
        }
    }
    if !record["value"].is_null()
        && (!record["value"].is_object()
            || !record["value"]["amount"]
                .as_f64()
                .is_some_and(|n| n.is_finite() && n >= 0.0))
    {
        return Err(fail());
    }
    if record["url"] != format!("https://prozorro.gov.ua/uk/tender/{public}") {
        return Err(fail());
    }
    Ok(())
}
fn text(v: &Value) -> String {
    v.as_str().unwrap_or("").to_string()
}
fn tender(raw: &Value, previous: Option<Value>) -> Value {
    // Start from the existing object: user-owned lifecycle/view/document fields survive.
    let mut t=previous.unwrap_or_else(||json!({"priority":"C","score":0,"aiScore":null,"category":"","topCategory":"Інше","status":"NEW","manager":"","stage":"","recommendation":"","region":""}));
    let public = text(&raw["publicId"]);
    t["id"] = json!(public);
    t["title"] = raw["title"].as_str().map_or(json!(""), |s| json!(s));
    t["officialTitle"] = t["title"].clone();
    t["customer"] = json!(text(&raw["customer"]));
    t["cpv"] = raw["cpv"]
        .as_array()
        .and_then(|a| a.first())
        .cloned()
        .unwrap_or(Value::Null);
    t["expectedValue"] = raw["value"]["amount"].clone();
    t["budget"] = json!(raw["value"]["amount"].as_f64().unwrap_or(0.0));
    t["currency"] = json!(text(&raw["value"]["currency"]));
    t["vatIncluded"] = raw["value"]["valueAddedTaxIncluded"].clone();
    t["sourceUrl"] = raw["url"].clone();
    t["sourceUrlProzorro"] = raw["url"].clone();
    t["prozorroStatus"] = raw["status"].clone();
    t["updatedAt"] = raw["dateModified"].clone();
    t["sourceItems"] = raw["items"].clone();
    t["analysisPending"] = json!(true);
    t["documents"]=json!(raw["documents"].as_array().unwrap().iter().map(|d|json!({"documentId":d["id"],"name":text(&d["title"]),"kind":text(&d["documentType"]),"url":d["url"],"sourceUrl":d["url"],"mimeType":d["format"],"datePublished":d["datePublished"],"dateModified":d["dateModified"],"facts":[],"sources":[],"text":""})).collect::<Vec<_>>());
    t["objects"] = json!(raw["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|i| {
            let mut o = json!({"name":text(&i["description"])});
            if i["quantity"].is_number() {
                o["quantity"] = i["quantity"].clone();
            }
            if i["unit"]["name"].is_string() {
                o["unit"] = i["unit"]["name"].clone();
            }
            o
        })
        .collect::<Vec<_>>());
    t["deadline"] = json!(raw["submissionEnd"]
        .as_str()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.format("%d.%m.%Y").to_string())
        .unwrap_or_default());
    t["submissionPeriod"] = if raw["submissionEnd"].is_null() {
        json!({})
    } else {
        json!({"end":raw["submissionEnd"]})
    };
    if let Some(date) = raw["publishedAt"].as_str() {
        t["publishedAt"] = json!(date);
        t["publicationDateSource"] = json!("source");
    } else {
        t["publishedAt"] = json!(public.get(3..13).unwrap_or(""));
        t["publicationDateSource"] = json!("tender-id");
    }
    let mut provenance = serde_json::Map::new();
    for key in [
        "title",
        "customer",
        "cpv",
        "expectedValue",
        "currency",
        "vatIncluded",
        "sourceItems",
        "objects",
        "submissionPeriod",
    ] {
        provenance.insert(
            key.into(),
            json!({"source":"prozorro","sourceId":raw["id"]}),
        );
    }
    t["provenance"] = json!(provenance);
    t
}
impl Database {
    pub fn apply_server_page(
        &mut self,
        scope: &str,
        expected: &str,
        page: &Page,
    ) -> Result<usize, String> {
        if page.version != 1
            || page.records.len() > 50
            || page.cursor.len() > 15
            || !page.cursor.bytes().all(|b| b.is_ascii_digit())
            || page.cursor.parse::<u64>().unwrap_or(0) < expected.parse::<u64>().unwrap_or(0)
            || (page.has_more && page.cursor == expected)
        {
            return Err("Некоректний sync cursor/DTO.".into());
        }
        for record in &page.records {
            validate(record)?;
        }
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        let current: String = tx
            .query_row(
                "SELECT cursor FROM sync_cursors WHERE scope=?1",
                [scope],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "0".into());
        if current != expected {
            return Err("Курсор змінився; повторіть синхронізацію.".into());
        }
        let mut changed = 0;
        for raw in &page.records {
            let id = text(&raw["publicId"]);
            let revision = text(&raw["revision"]);
            let old: Option<(String, String)> = tx
                .query_row(
                    "SELECT revision,modified_at FROM server_revisions WHERE tender_id=?1",
                    [&id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            if let Some((hash, date)) = old {
                if hash == revision
                    || chrono::DateTime::parse_from_rfc3339(&date)
                        .map_err(|_| "Invalid stored source date")?
                        >= chrono::DateTime::parse_from_rfc3339(
                            raw["dateModified"].as_str().unwrap(),
                        )
                        .map_err(|_| "Invalid source date")?
                {
                    continue;
                }
            }
            let previous: Option<String> = tx
                .query_row("SELECT payload FROM tenders WHERE id=?1", [&id], |r| {
                    r.get(0)
                })
                .optional()
                .map_err(|e| e.to_string())?;
            let payload = tender(
                raw,
                previous
                    .map(|s| serde_json::from_str(&s))
                    .transpose()
                    .map_err(|e| e.to_string())?,
            );
            tx.execute("INSERT INTO tenders(id,payload) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=tenders.revision+1",params![id,payload.to_string()]).map_err(|e|e.to_string())?;
            let now = chrono::Utc::now().to_rfc3339();
            tx.execute(
                "INSERT OR IGNORE INTO comments(tender_id,updated_at) VALUES(?1,?2)",
                params![id, now],
            )
            .map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT OR IGNORE INTO statuses VALUES(?1,'NEW',?2)",
                params![id, now],
            )
            .map_err(|e| e.to_string())?;
            tx.execute("INSERT INTO tender_sources(tender_id,source,external_id,raw_json) VALUES(?1,'prozorro',?2,?3) ON CONFLICT(source,external_id) DO UPDATE SET raw_json=excluded.raw_json",params![id,text(&raw["id"]),raw.to_string()]).map_err(|e|e.to_string())?;
            tx.execute("INSERT INTO server_revisions VALUES(?1,?2,?3,?4) ON CONFLICT(tender_id) DO UPDATE SET revision=excluded.revision,dto=excluded.dto,modified_at=excluded.modified_at",params![id,revision,raw.to_string(),text(&raw["dateModified"])]).map_err(|e|e.to_string())?;
            tx.execute("INSERT INTO history(tender_id,kind,text,at) VALUES(?1,'sync','Офіційні дані Prozorro синхронізовано',?2)",params![id,now]).map_err(|e|e.to_string())?;
            changed += 1;
        }
        tx.execute("INSERT INTO sync_cursors VALUES(?1,?2,?3) ON CONFLICT(scope) DO UPDATE SET cursor=excluded.cursor,updated_at=excluded.updated_at",params![scope,page.cursor,chrono::Utc::now().to_rfc3339()]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(changed)
    }
}
pub fn download(
    config_path: &Path,
    storage: &std::sync::Mutex<Database>,
) -> Result<Report, String> {
    let bytes = std::fs::read(config_path)
        .map_err(|_| "Налаштуйте приватний sync-config.json у папці даних програми.".to_string())?;
    if bytes.len() > 8192 {
        return Err("Некоректна sync конфігурація.".into());
    }
    let c: Config =
        serde_json::from_slice(&bytes).map_err(|_| "Некоректна sync конфігурація.".to_string())?;
    let url =
        reqwest::Url::parse(&c.base_url).map_err(|_| "Некоректна адреса сервера.".to_string())?;
    let local = c.allow_local_http
        && url.scheme() == "http"
        && matches!(url.host_str(), Some("127.0.0.1") | Some("[::1]"));
    if (url.scheme() != "https" && !local)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
        || c.token.len() < 32
        || c.token.len() > 200
        || !c
            .token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        || c.client_id.is_empty()
        || c.client_id.len() > 120
    {
        return Err("Потрібні HTTPS сервер та коректна приватна конфігурація.".into());
    }
    let scope = format!("adm:{}:{}", c.base_url, c.client_id);
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Native HTTP initialization failed".to_string())?;
    let mut report = Report::default();
    let start = Instant::now();
    for _ in 0..10 {
        if start.elapsed() > Duration::from_secs(60) {
            report.has_more = true;
            break;
        }
        let cursor = storage
            .lock()
            .map_err(|_| "SQLite lock failed")?
            .connection
            .query_row(
                "SELECT cursor FROM sync_cursors WHERE scope=?1",
                [&scope],
                |r| r.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "0".into());
        let response = client
            .get(
                url.join("api/v1/tenders")
                    .map_err(|_| "Invalid server URL")?,
            )
            .query(&[("cursor", cursor.as_str()), ("limit", "20")])
            .bearer_auth(&c.token)
            .send()
            .map_err(|_| "Sync сервер недоступний; локальні дані збережено.".to_string())?;
        if !response.status().is_success() {
            return Err(format!("Sync API: HTTP {}", response.status().as_u16()));
        }
        let mut bytes = Vec::new();
        response
            .take(4 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Sync response read failed")?;
        if bytes.len() > 4 * 1024 * 1024 {
            return Err("Sync response exceeds size limit".into());
        }
        let page: Page = serde_json::from_slice(&bytes)
            .map_err(|_| "Некоректна відповідь Sync API.".to_string())?;
        report.changed += storage
            .lock()
            .map_err(|_| "SQLite lock failed")?
            .apply_server_page(&scope, &cursor, &page)?;
        report.received += page.records.len();
        report.pages += 1;
        report.has_more = page.has_more;
        if !page.has_more {
            break;
        }
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn record() -> Value {
        // Unit-only DTO fixture. Integration evidence uses real API records.
        json!({"version":1,"source":"prozorro","id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","publicId":"UA-2026-10-08-000001-a","revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","dateModified":"2026-10-08T10:00:00+03:00","title":"Unit DTO","customer":null,"cpv":["43262100-8"],"publishedAt":null,"submissionEnd":null,"value":null,"status":null,"url":"https://prozorro.gov.ua/uk/tender/UA-2026-10-08-000001-a","items":[],"documents":[]})
    }
    fn database(label: &str) -> Database {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../_temp/other/sqlite-tests")
            .join(format!(
                "sync-{label}-{}.sqlite",
                chrono::Utc::now().timestamp_nanos_opt().unwrap()
            ));
        Database::open(&path).unwrap()
    }
    #[test]
    fn update_and_replay_preserve_user_data_and_cursor() {
        let mut db = database("preserve");
        let raw = record();
        let page = Page {
            version: 1,
            records: vec![raw.clone()],
            cursor: "1".into(),
            has_more: false,
        };
        assert_eq!(db.apply_server_page("test", "0", &page).unwrap(), 1);
        db.comment(
            "UA-2026-10-08-000001-a",
            Some("local comment".into()),
            Some("yellow".into()),
        )
        .unwrap();
        db.view("UA-2026-10-08-000001-a").unwrap();
        db.preference("zoom", json!(125)).unwrap();
        let mut changed = raw;
        changed["title"] = json!("Official update");
        changed["revision"] =
            json!("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        changed["dateModified"] = json!("2026-10-08T11:00:00+03:00");
        let page = Page {
            version: 1,
            records: vec![changed],
            cursor: "2".into(),
            has_more: false,
        };
        assert_eq!(db.apply_server_page("test", "1", &page).unwrap(), 1);
        let before = db.tender("UA-2026-10-08-000001-a").unwrap();
        assert_eq!(before["commentText"], "local comment");
        assert_eq!(before["commentColor"], "yellow");
        assert!(before["firstViewedAt"].is_string());
        assert!(before["expectedValue"].is_null());
        assert_eq!(before["title"], "Official update");
        assert_eq!(db.apply_server_page("test", "2", &page).unwrap(), 0);
        assert_eq!(db.tender("UA-2026-10-08-000001-a").unwrap(), before);
        let path = db.path.clone();
        drop(db);
        let db = Database::open(&path).unwrap();
        assert_eq!(db.tender("UA-2026-10-08-000001-a").unwrap(), before);
        assert_eq!(db.load().unwrap().preferences["zoom"], 125);
    }
    #[test]
    fn invalid_page_rolls_back_all_records_and_cursor() {
        let mut db = database("invalid");
        let mut invalid = record();
        invalid["cpv"] = json!(["український"]);
        let page = Page {
            version: 1,
            records: vec![record(), invalid],
            cursor: "2".into(),
            has_more: false,
        };
        assert!(db.apply_server_page("test", "0", &page).is_err());
        assert_eq!(db.load().unwrap().tenders.len(), 1);
        assert_eq!(
            db.connection
                .query_row("SELECT COUNT(*) FROM sync_cursors", [], |r| r
                    .get::<_, usize>(0))
                .unwrap(),
            0
        );
    }
}
