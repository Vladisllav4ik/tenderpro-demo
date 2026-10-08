# Tender PRO: Agent 1 / ADM backend

PHP 8.2+ (PDO MySQL, cURL, JSON, OpenSSL), MySQL 8 / MariaDB 10.6+, CLI PHP and HTTPS. No Composer framework required. Only `server/api/` is the public document root. `src`, migrations, configuration and logs must be outside it. Do not upload the project `.env`, `.tenderpro-local`, `_temp`, or desktop data.

ADM stage 3.1: [hosting-specific upload/Cron instructions](deploy/ADM_DEPLOY.md). Build the secret-free package with `pwsh -File server/deploy/build-adm-package.ps1` (PowerShell 7). The ZIP puts only `index.php` and `.htaccess` in `www`; backend/configuration/logs/Cron are outside it. Hosting parameters supplied: PHP 8.3, Percona 8.4, Apache, HTTPS, 15-minute Cron. CLI executable, DB host/user and AllowOverride still require on-host verification; no automatic deployment is performed.

## Private configuration and isolated deployment

1. ADM parameters supplied for stage 3.1: PHP 8.3, Percona Server 8.4, Apache, HTTPS and 15-minute Cron. Confirm CLI executable/extensions, actual DB host/user, AllowOverride, memory/time/request limits, storage quota and private log permissions on the host. ADM has **not** been deployed or tested remotely; use the dedicated package instructions above.
2. Create a new isolated database and restricted DB user. Copy `config.example.php` to a private directory outside the public root, replace its credentials there, keep `allow_local_http=false`. Set `TENDERPRO_CONFIG` to its absolute path for CLI and PHP-FPM/Apache. Never commit credentials.
3. `php server/src/database/manage.php migrate`. Migration uses MySQL DDL; back up first, do not run against another application's database. The runtime DB account needs only SELECT/INSERT/UPDATE/DELETE and advisory lock access after migration.
4. `php server/src/database/manage.php profile business-test '43262100-8' '34223300-9' '4326*'`. Filters live in `cpv_filters`; disable by `enabled=0`. Prefixes are validated digits, never SQL LIKE. No permanent default rules are seeded. The optional subscription XLSX was not found in the workspace or Downloads root. Test codes can be supplied manually.
5. Generate a random token with at least 32 characters; export it privately as `TENDERPRO_CLIENT_TOKEN`, then `php server/src/database/manage.php client DEVICE-ID`. Only its SHA-256 hash is stored in MySQL. Unset the environment variable afterward.
6. Map a separate HTTPS virtual host to `server/api/`; forward `Authorization` to PHP, rewrite paths to `index.php`. Apache `.htaccess` is included. Disable PHP `display_errors` in production and send `error_log` to a private rotating log. Do not trust an arbitrary client `X-Forwarded-Proto`; configure HTTPS at the trusted web server.
7. Run a bounded manual scan and verify health/API/desktop before enabling the sample Cron. Cron is a sample, not an activated job.

## Real scanning and cursors

```sh
php server/cron/collect.php --profile=1 --mode=recent --limit=20 --seconds=60
php server/cron/collect.php --profile=1 --mode=recent --limit=20 --seconds=60 --repeat
php server/cron/collect.php --profile=1 --mode=recent --limit=20 --seconds=60
php server/cron/collect.php --profile=1 --mode=forward --limit=100 --seconds=60
```

`recent` starts with the official descending feed and resumes its saved reverse cursor. Explicit `--repeat` replays the captured initial page for deduplication checks. `forward` uses a separate cursor for regular updates; its initial watermark is captured when a new recent scan begins, or at the current feed head if first used alone. It does not import all historical data. Profiles created before this watermark implementation need a fresh profile to capture a watermark at their first recent page.

The feed only provides identifiers/modification dates; the collector reads details, checks root and item CPV, then stores matching records. Empty matches are successful. It persists the pending page/index **before** processing and advances the index in the same transaction as the tender/revision/event. A failure retains the failed ID. MySQL advisory lock prevents overlapping runs. Each run is bounded by up to 200 details and 120 seconds, with network timeouts, response caps and three attempts using exponential backoff. Logs contain operation/type/code, never exception text or tokens.

Canonical identity is the internal Prozorro ID plus source; public UA-ID is also unique. SHA-256 of the source JSON identifies revisions. Older versions do not overwrite newer records. `collector_runs.statistics` stores real counters and cursor; `tender_revisions.matched_filters` stores which filter/code matched. User comments/colors are not server fields.

Official feed semantics: [Prozorro documentation](https://prozorro-api-docs.readthedocs.io/uk/latest/basic-actions/feed.html). Use returned opaque `next_page.offset`; never invent timestamp cursors. Initial `descending=1`, no `mode=test`, page size 20. Production endpoint is `https://public-api.prozorro.gov.ua/api/2.5`.

## API v1

All endpoints require `Authorization: Bearer TOKEN` and HTTPS. Loopback HTTP is explicitly opt-in for local integration tests only.

- `GET /api/v1/health`: version/status, no private configuration.
- `GET /api/v1/scan-status`: last 10 bounded scan logs.
- `GET /api/v1/tenders?cursor=0&limit=20`: immutable revision events, `{version:1,records:[],cursor:"…",hasMore:false}`. Limit 1–50. Default 20. Cursor is an increasing event ID string; **updates are included**. This endpoint is the unfiltered device sync feed; arbitrary filter/query parameters are rejected, so filtering cannot cause the desktop to skip changes.
- `GET /api/v1/tenders/INTERNAL_ID`: latest normalized source DTO, 404 if absent.

DTO includes canonical/public IDs, source revision, exact source title/customer/CPV, timestamps, value, status, official URL, items and document metadata. Missing values remain null. No AI generation, category inference, document parsing, or synthetic fallback. HTTP error bodies are sanitized; authentication is checked before any data endpoint. No public scan endpoint exists. Configure host-level request/rate limits on ADM after confirming its capabilities.

## Desktop

Place private `sync-config.json` in `%APPDATA%\ua.tenderpro.desktop.foundation\`:

```json
{"baseUrl":"https://YOUR-ISOLATED-HOST/","clientId":"DEVICE-ID","token":"REPLACE_PRIVATELY","allowLocalHttp":false}
```

This file is read only by Rust; it is not included in frontend assets. Protect it with the Windows user profile ACL. Native HTTPS has no redirects, bounded response/time/page limits. Click **Оновити тендери**. Each page is validated and transactionally committed with its cursor. SQLite migration 002 upgrades the existing database without reset. Official payload/source revisions update; comments, colors, business statuses, view/lifecycle fields and preferences survive. Repeated revisions add no history entries. There is no outbound upload of user data. Keep the server URL/client ID stable to resume the same cursor.

The adapter uses public UA-ID as the existing table ID, canonical ID in `tender_sources`; unknown budget has a legacy internal numeric zero but `expectedValue:null` for display. `aiScore:null` and analysis pending mean no AI analysis. Publication fallback is explicitly labeled `tender-id` when the API omits dateCreated. Source metadata has provenance. Existing desktop foundation data is retained.

## Other sources

`SourceConnector` defines feed/detail/source identity; only Prozorro implements it. [Zakupivli.Pro officially offers direct API integration](https://blog.zakupivli.pro/integracziya-zakupivli-pro-z-crm-systemamy/), access/schema/rate limits must be agreed with their integration team. [SmartTender lists API integration in its commercial packages](https://smarttender.biz/commercial/taryfy-komertsiyni/); a public unrestricted scanning API contract was not verified. Credentials, terms and canonical-ID mappings are required before implementing either connector. Neither broker is simulated or scraped.

## Tests

`php server/tests/cpv.php`: deterministic matcher tests, no DB/network.

`php server/tests/integration.php`: requires **isolated** migrated MySQL and real Prozorro access, creates a separate test profile, injects one interruption before a detail request, then resumes with a new collector. Writes test evidence only under ignored `_temp/reports`. Does not delete records. `npm run desktop:test`, `npm run typecheck`, `npm test`, `npm run build`, `npm run desktop:build` verify the existing web and native builds. See `docs/testing/ADM_AGENT1_RESULTS.md` for executed outcomes and limitations.
