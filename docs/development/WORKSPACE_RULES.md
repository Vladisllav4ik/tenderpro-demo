# Правила робочого простору

- Desktop Foundation розробляється у `desktop-migration`; `main` і production конфігурація зберігаються.
- Скриншоти — `_temp/screenshots`, логи — `_temp/logs`, одноразові звіти — `_temp/reports`, інші результати — `_temp/other`.
- `_temp` можна повністю видалити; програма не може читати звідти робочі дані чи імпортувати модулі.
- Постійні тести й fixtures — `tests`; native fixture — `src-tauri/fixtures`.
- Документація — `docs/architecture`, `docs/agents`, `docs/development`, `docs/testing`; README лишається в корені.
- Не торкатися `.tenderpro-local`, `.env` і desktop AppData під час очищення артефактів.
- Перед recursive move/delete перевірити абсолютний шлях та межі workspace.
- Після етапу перевірити корінь, `git diff --check`, links/imports та обидві збірки.
