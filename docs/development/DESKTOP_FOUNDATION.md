# Desktop Foundation — етап №2

## Межі

Спільні `TenderWorksheet`, `TenderCard`, `Tenders`, `TenderDetail`, `GlobalHotbar`, `AppShell`, `AccountSettings`, ADMIN screens і CSS використовуються без редизайну. Desktop має власний root, hash router і adapters. Вебверсія використовує початкові модулі; `vite.config.ts` не змінено. `vite.desktop.config.ts` підміняє лише desktop imports і перевіряє відсутність server modules у SPA bundle.

React entry: `src/desktop/main.tsx`. SQLite DAL: `repository.ts`. UI state: `store.tsx`, preferences: `workspace.ts`. Native commands: `src-tauri/src/lib.rs`; schema/repositories: `database.rs`, `migrations/001_foundation.sql`.

Desktop — окремий локальний тестовий профіль ADMIN `Desktop POC`, не імітація реальної авторизації. Джерело `desktop-demo`, ID `DESKTOP-POC-001`; fixture не потрапляє до web storage. Дані явно демонстраційні.

## SQLite

Path визначається `app.path().app_data_dir()`, не cwd. Windows зазвичай `%APPDATA%/ua.tenderpro.desktop.foundation/tenderpro.sqlite`; точний шлях повертає `desktop_load.diagnostics.databasePath`.

Міграція №1 — одна транзакція, `schema_migrations` / `user_version`. Newer schema блокує downgrade. Увімкнено foreign keys, WAL, busy timeout. При відкритті виконуються integrity/foreign-key checks. Запити параметризовані.

`tenders` зберігає базовий JSON; `comments`, `statuses`, `history` — окремі сутності. Читання формує merged Tender. Частковий update коментаря не перезаписує колір; зміна кольору не перезаписує текст. Запис, revision та history — одна транзакція. Preferences у SQLite. Seed ідемпотентний; restart не скидає зміни.

`documents`, `document_versions`, `ai_results`, `agent_jobs`, `sync_outbox`, `sync_cursors` — резерв архітектури. Worker, sync і AI-виконання зараз відсутні.

БД доступна через вузькі Rust-команди; generic SQL/fs/shell/HTTP permissions не надаються. CSP забороняє remote connections. Локальний Manrope постачається з assets.

## Закриття й помилки

UI використовує наявний debounce. Native close listener викликає blur/pagehide, дочікується SQLite writes і закриває вікно. При помилці запису вікно залишається відкритим. Примусове завершення процесу до відправлення debounce може втратити ще не записані символи.

## Не підключено

Node sidecar, AI 2–4, Agent 1/discovery, Prozorro watcher, ADM/PHP/MySQL/API, справжня auth, document parsing backend, Excel import із запуском AI. Controls збережені; actions повідомляють недоступність. «AI parsed» не створюється кліком.

Демонстраційний тендер не має реального procurement URL. Системне відкриття URL, file dialogs і production document preview — наступні узгоджені етапи.

## Команди

`npm run desktop:dev` — Vite + native dev app. `npm run desktop:build` — статична SPA та Windows EXE/NSIS. `npm run desktop:test` — native SQLite tests. Rust output: `src-tauri/target`, ignored. QA results: `_temp`, ignored.

До етапу №3 не переходити без погодження.
