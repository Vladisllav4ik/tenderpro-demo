# Tender PRO — перевірка ADM deployment package, етап 3.1

Підготовлено для `api-tenderpro.solomons.com.ua`, root `/home/th604799/api-tenderpro.solomons.com.ua/`, document root `www/`, база `th604799_tenderpro`. Гілка `desktop-migration`. Windows-програма, frontend, SQLite і main не змінювалися. На ADM нічого не завантажувалося й не запускалося.

## Пакет

Архів: `_temp/reports/TenderPro_ADM_stage3.1.zip`. Відтворення: PowerShell 7, `./server/deploy/build-adm-package.ps1`. Перевірка: `./server/deploy/test-package.ps1`.

Вміст: тільки `www/index.php`, `www/.htaccess` публічно; у `private` — backend, конфігураційний шаблон, CLI/cron wrappers, міграції, порожні logs/state. В архіві є інструкція, цей звіт та SHA-256 manifest. Збірка використовує явний перелік файлів: не копіює реальні конфігурації, локальні дані, тестові токени, журнали, runtime чи EXE. Linux-файли мають LF без BOM. Сам ZIP завантажується й розпаковується в root **поза www**.

## Фактично виконано локально

- Окремий portable **PHP 8.3.32**: syntax check усіх 17 PHP-файлів пакета та 8 CPV assertions — успіх. Використання PHP 8.5 для попереднього етапу не вважається перевіркою PHP 8.3.
- Окремий portable **Apache 2.4.69** на localhost, TLS із тестовим сертифікатом: `httpd -t` — Syntax OK.
- Два режими PHP handler: Apache module і FastCGI 8.3.32. По **15 assertions** у кожному: health 200 з Bearer / 401 без токена, tenders і scan-status 200, некоректні параметри 400, невідомий ID/route 404, POST 405, приватні шляхи 403, HTTP 308 із query string на фіксований HTTPS-домен. Authorization проходить internal rewrite. Для локального Windows FastCGI потрібне явне відображення SCRIPT_FILENAME у тестовому virtual host; це локальна конфігурація Apache, не файл пакета чи налаштування ADM.
- Окрема порожня локальна база `th604799_tenderpro` у MySQL-сумісній **MariaDB 11.4.12**, порт 3310: міграція CLI створила 11 таблиць; preflight підтвердив PHP CLI, розширення, точне ім’я бази, доступ до logs. Повторний CLI migrate — без змін. У SQL явно InnoDB/utf8mb4; немає операцій видалення або зміни інших баз.
- Реальний обмежений запуск `first-scan.php` на PHP 8.3: 20 ID/details, 21 CPV, 0 збігів, **0 помилок**. Фільтри тесту `4326*`, `34223300-9`; результати не вигадувалися. Повторний виклик повернув `First scan already completed; no requests made`.
- Shell wrapper перевірено через Git POSIX sh: syntax check, preflight та first mode успішні. У Linux Cron команда викликає `/bin/sh` і читає приватний CLI-path; executable bit для wrapper не потрібний.
- Виконано саме forward mode shell wrapper: 100 ID/details, 104 CPV, 0 збігів, 0 нових, **0 помилок**; ліміти 100/60 і збережений курсор працюють.
- Runtime перевіряє ім’я поточної бази перед запитами/записами. Два послідовні виклики з неправильним expected database відхилені до запису, без обходу через кеш PDO. DB connect timeout — 5 секунд.
- ZIP перевірено: public allowlist, відсутність секретних/data/runtime файлів, плейсхолдери DB, міграція потрібної бази, LF/no BOM і відповідність усіх файлів SHA-256 manifest.

QA-файли лише під `_temp`: `adm31-routing-mod-php83.json`, `adm31-routing-fastcgi83.json`, `adm31-first-scan.json`, `adm31-cron-forward.json`, тимчасові runtime/configuration/logs. Ці матеріали не входять у ZIP. Локальні тестові процеси Apache/PHP-CGI після перевірки зупиняються; існуючий EXE та сервер попереднього етапу не змінюються.

## Що ще перевірити на ADM

Реальний **Percona Server 8.4** без доступу не перевірявся. Локальна MariaDB перевірка підтверджує виконання стандартного MySQL SQL, але не замінює запуск на Percona. Відомі з повідомлення власника PHP 8.3, Percona 8.4, Apache, HTTPS та Cron 15 хв; ще потрібні фактичні DB host/user/password, абсолютний PHP CLI-path, розширення CLI, вихідний HTTPS/CA, AllowOverride/mod_rewrite, довірена ознака HTTPS і runtime/memory/quota limits.

Інструкція з точною Cron-командою: [ADM_DEPLOY.md](../../server/deploy/ADM_DEPLOY.md). Постійний Cron активується вручну лише після preflight, API й першого сканування. Deployment автоматично не виконувався; це підготовлений і перевірений локально пакет.
