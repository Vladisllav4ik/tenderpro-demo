CREATE TABLE server_revisions(tender_id TEXT PRIMARY KEY REFERENCES tenders(id), revision TEXT NOT NULL, dto TEXT NOT NULL CHECK(json_valid(dto)), modified_at TEXT NOT NULL);
INSERT INTO schema_migrations VALUES(2,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
PRAGMA user_version=2;
