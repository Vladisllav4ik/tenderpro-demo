# Tender PRO — пакет ADM, етап 3.1

Ціль: `https://api-tenderpro.solomons.com.ua`, PHP 8.3, Percona Server 8.4, Apache, Cron раз на 15 хвилин. Ці параметри надані власником; автоматичного підключення чи deployment не виконано.

## 1. Завантаження та розпакування

Завантажте `TenderPro_ADM_stage3.1.zip` у **`/home/th604799/api-tenderpro.solomons.com.ua/`**, НЕ в `www`.

Розпакуйте **вміст архіву прямо в цей каталог**, без додаткової вкладеної папки. У файловому менеджері ввімкніть показ прихованих файлів: `www/.htaccess` має бути присутній. Після розпакування видаліть завантажений ZIP із хостингу або залиште лише поза публічним каталогом.

```text
/home/th604799/api-tenderpro.solomons.com.ua/
├── ADM_DEPLOY.md
├── ADM_PACKAGE_CHECKS.md
├── MANIFEST.sha256
├── www/
│   ├── index.php
│   └── .htaccess
└── private/
    ├── api.php
    ├── runtime.php
    ├── config.example.php
    ├── php-cli.example
    ├── app/
    │   ├── api/index.php
    │   ├── src/{config,database,sources,collector,filters,sync}/
    │   ├── cron/collect.php
    │   └── migrations/{001_empty_adm.sql,001_collector.sql}
    ├── bin/{preflight.php,manage.php,register-client.php}
    ├── cron/{run.sh,collect.php,first-scan.php}
    ├── logs/.keep
    └── state/.keep
```

`config.php`, `php-cli.path`, журнали й маркери запуску створюються **лише на хостингу**, їх немає в ZIP. Рекомендовані права: приватні каталоги 700, конфігурація/CLI-path 600, публічні каталоги 755, `index.php` та `.htaccess` 644. PHP має виконуватися від користувача th604799 або мати мінімальний потрібний доступ; не встановлюйте 777. Якщо ADM запускає PHP іншим користувачем, узгодьте необхідні групові права з підтримкою.

DocumentRoot домену має бути **`/home/th604799/api-tenderpro.solomons.com.ua/www/`**, а не кореневий каталог. Не розпаковуйте пакет поверх іншого сайту.

## 2. Приватна конфігурація MySQL

У файловому менеджері скопіюйте `private/config.example.php` у `private/config.php`. Відредагуйте лише копію:

```php
<?php
return [
    'dsn'=>'mysql:host=ACTUAL_ADM_DB_HOST;port=3306;dbname=th604799_tenderpro;charset=utf8mb4',
    'user'=>'ACTUAL_ADM_DB_USER',
    'password'=>'ACTUAL_PRIVATE_PASSWORD',
    'allow_local_http'=>false,
    'ca_file'=>null,
];
```

**DB host і DB username ще не надані.** Візьміть їх із панелі ADM; ім’я бази не означає автоматично таке саме ім’я користувача. Пароль вводьте тільки в приватну копію. Для API й Cron шлях конфігурації встановлює приватний runtime — `SetEnv` у Apache не потрібний. Для віддаленого DB-host окремо узгодьте TLS/мережеві умови; приклад розрахований на звичайне внутрішнє підключення ADM.

Runtime відхиляє підключення до бази з будь-яким іншим ім’ям, перш ніж виконати запис. Використовуйте DB-користувача з доступом лише до th604799_tenderpro; після міграції Collector/API потрібні SELECT/INSERT/UPDATE/DELETE, а не керування чужими базами.

## 3. SQL у порожню базу

Відкрийте phpMyAdmin, виберіть **`th604799_tenderpro`**, переконайтеся, що таблиць немає. Вкладка «Імпорт» → файл **`private/app/migrations/001_empty_adm.sql`** з архіву → UTF-8 → виконати.

Міграція містить `USE th604799_tenderpro`, InnoDB, utf8mb4, ключі/індекси/FK. Немає DROP, DELETE, TRUNCATE, CREATE DATABASE або користувачів/паролів. Очікується **11 таблиць**: десять бізнес-сутностей + `schema_migrations`. Значення версії — 1.

`001_collector.sql` — та сама міграція під іменем, яке використовує CLI. **Не імпортуйте обидва файли й не запускайте повторний ручний імпорт.** Існуючі таблиці викличуть помилку, щоб не приховати неправильну ціль. CLI `manage.php migrate` після ручного імпорту прочитає версію й нічого не створюватиме.

Для керування CPV без SSH виконайте в phpMyAdmin після погодження кодів:

```sql
INSERT INTO search_profiles(id,name,enabled) VALUES(1,'adm-business',1);
-- Приклад, НЕ затверджені автоматично бізнес-правила: замініть потрібними CPV.
INSERT INTO cpv_filters(profile_id,pattern,enabled) VALUES
  (1,'43262100-8',1),
  (1,'34223300-9',1),
  (1,'4326*',1);
```

Без хоча б одного ввімкненого погодженого фільтра Collector не сканує. Вимкнення: `UPDATE cpv_filters SET enabled=0 WHERE id=...`. Для точного CPV формат `12345678-9`, для групи — 2–8 цифр і `*`. Значення звіряються в PHP, не через SQL LIKE.

## 4. Токен пристрою без секретів у SQL або ZIP

Створіть **новий випадковий токен** локально, наприклад у PowerShell 7:

```powershell
$token = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$tokenFile = Join-Path $env:USERPROFILE 'TenderPro_ADM_token.txt'
[IO.File]::WriteAllText($tokenFile, $token)
$hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($token))).ToLowerInvariant()
$hash  # тільки цей hash вставляється у SQL
```

Збережіть приватний tokenFile під своїм Windows-акаунтом; не завантажуйте його на hosting і не додавайте до Git/ZIP. У phpMyAdmin:

```sql
INSERT INTO sync_clients(id,token_hash,enabled)
VALUES('desktop-01','REPLACE_WITH_64_CHARACTER_SHA256_HASH',1);
```

Альтернатива з CLI: `PHP83 private/bin/register-client.php desktop-01 SHA256_HASH`. Передається тільки hash; plaintext token не передається в Cron або командному рядку. Windows-програму на цьому етапі змінювати не потрібно.

## 5. PHP CLI та preflight

Попросіть ADM підтвердити **абсолютний шлях до CLI PHP 8.3**. Web PHP 8.3 не доводить, що `/usr/bin/php` — саме ця версія. Скопіюйте `private/php-cli.example` у **`private/php-cli.path`** та замініть увесь рядок реальним шляхом, без лапок/аргументів. Цей шлях не був вигаданий і не зашитий у Cron.

Потрібні розширення `curl`, `pdo_mysql`, `openssl`, `json`; writable private/logs і private/state, вихідний HTTPS до public-api.prozorro.gov.ua, пам’ять щонайменше 128 MB та дозволений CLI runtime близько 90 секунд. API потребує `mod_rewrite` і дозволених `.htaccess` директив `FileInfo`, `Options`, `Indexes`. Самого факту Apache недостатньо, щоб підтвердити його AllowOverride на ADM.

Якщо є Terminal/SSH:

```sh
/bin/sh /home/th604799/api-tenderpro.solomons.com.ua/private/cron/run.sh preflight
```

Без Terminal створіть **тимчасове** завдання Cron із цією командою, дочекайтеся запуску та перегляньте лог, потім видаліть завдання:

```sh
/bin/sh /home/th604799/api-tenderpro.solomons.com.ua/private/cron/run.sh preflight >> /home/th604799/api-tenderpro.solomons.com.ua/private/logs/preflight.log 2>&1
```

Очікується JSON `ok:true`, `sapi:"cli"`, PHP 8.3.x, потрібна база, 11 таблиць. Скрипт перевіряє DB і розширення без зміни даних. Запит із HTTP до будь-якого private-файлу недоступний. Не створюйте публічний phpinfo/installer/scan endpoint.

## 6. Apache та API

Запит до `http://api-tenderpro.solomons.com.ua/api/v1/health` має дати **308** на фіксований HTTPS-домен. `.htaccess` переписує API-шляхи на єдиний `www/index.php`, зберігає query string і Bearer header. Внутрішній entrypoint приймає `REDIRECT_HTTP_AUTHORIZATION` після rewrite. Код не довіряє клієнтському `X-Forwarded-Proto`.

Без токена HTTPS health повертає **401**; із токеном — **200**, `{"version":1,"status":"ok"}`. При відсутній конфігурації — санітизована помилка, а не phpinfo чи credentials.

Для локальної перевірки PowerShell, без токена в командній історії:

```powershell
$token = [IO.File]::ReadAllText((Join-Path $env:USERPROFILE 'TenderPro_ADM_token.txt')).Trim()
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod 'https://api-tenderpro.solomons.com.ua/api/v1/health' -Headers $headers
Invoke-RestMethod 'https://api-tenderpro.solomons.com.ua/api/v1/scan-status' -Headers $headers
Invoke-RestMethod 'https://api-tenderpro.solomons.com.ua/api/v1/tenders?cursor=0&limit=20' -Headers $headers
```

До першого сканування список `records` порожній — це нормальний результат. Далі `/api/v1/tenders/INTERNAL_32_HEX_ID` має повертати DTO або 404. `limit=500`, `cursor=bad`, невідомі query-параметри — 400. `/private/config.php`, `/logs/`, `/.env` — 403/404, жодного вмісту приватних файлів.

Якщо Apache повертає 500 до PHP, перевірте його error log та AllowOverride/mod_rewrite з підтримкою. Не прибирайте захист приватних файлів. Якщо TLS завершується на proxy ADM, а `%{HTTPS}`/PHP `HTTPS` не виставлено, підтримка має налаштувати довірене визначення HTTPS у virtual host; інакше можливий redirect loop. Не виправляйте це довірою до довільного клієнтського заголовка.

## 7. Перше обмежене сканування

Після preflight, SQL-профілю та API-перевірки:

```sh
/bin/sh /home/th604799/api-tenderpro.solomons.com.ua/private/cron/run.sh first >> /home/th604799/api-tenderpro.solomons.com.ua/private/logs/first-scan.log 2>&1
```

Запустіть у Terminal або як тимчасове Cron-завдання. Без Terminal одноразовий wrapper безпечний: після успіху створює `private/state/first-scan.done`; наступний запланований виклик **не сканує повторно**. Після отримання успішного журналу видаліть тимчасове завдання. За помилки маркер не створюється, наступний запуск відновлює збережений курсор.

Перевіряється максимум 20 деталей / 60 секунд, тільки реальний feed, CPV із root/items, 0 збігів — успіх. Журнал показує IDs/details/CPV/matched/new/updated/duplicates/errors/cursor; результати також у collector_runs і `/api/v1/scan-status`. Для свідомого повтору початкового bounded-обходу через цей wrapper можна видалити лише `private/state/first-scan.done` — **не базу, не курсори і не тендери**. Це продовжить recent-курсор; exact replay першої сторінки доступний CLI `collect.php --repeat`.

За доступного Terminal exact replay:

```sh
# PHP83 тут означає підтверджений абсолютний CLI-path із private/php-cli.path.
PHP83 /home/th604799/api-tenderpro.solomons.com.ua/private/cron/collect.php --profile=1 --mode=recent --limit=20 --seconds=60 --repeat
```

## 8. Точна команда постійного Cron

У панелі ADM: хвилини `*/15`, години/дні/місяці/дні тижня `*`.

**Поле команди — скопіювати повністю:**

```sh
/bin/sh /home/th604799/api-tenderpro.solomons.com.ua/private/cron/run.sh forward >> /home/th604799/api-tenderpro.solomons.com.ua/private/logs/collector.log 2>&1
```

Повний crontab-рядок, якщо панель приймає весь рядок:

```cron
*/15 * * * * /bin/sh /home/th604799/api-tenderpro.solomons.com.ua/private/cron/run.sh forward >> /home/th604799/api-tenderpro.solomons.com.ua/private/logs/collector.log 2>&1
```

Wrapper запускає **profile 1**, forward cursor, максимум 100 details / 60 секунд, без токена/пароля в команді. MySQL GET_LOCK запобігає перекриттю двох колекторів. Курсор записується з даними в транзакції; невдалий ID не пропускається. `run.sh` викликається через `/bin/sh`, executable bit не потрібний; ZIP має LF без BOM.

Активуйте лише після успішного першого запуску та підтвердження ADM CLI/cURL/runtime лімітів. Якщо профіль має інший ID, змініть `--profile=1` у private/cron/run.sh на погоджений ID. Контролюйте розмір приватних журналів, налаштуйте ротацію засобами hosting або періодично архівуйте їх поза www.

## 9. Межі перевірки

Пакет готується локально; FTP/SSH/панель ADM не використовувалися. Реальні credentials, токени, локальні тендери, `.env`, SQL dumps, PHP/Apache runtime та журнали **не входять у ZIP**. Windows EXE/SQLite/frontend не змінювалися.

Перевірені локальні результати записані окремо в `docs/testing/ADM_DEPLOY_PACKAGE_RESULTS.md`. На ADM після ручного завантаження потрібно підтвердити AllowOverride, передачу Authorization, HTTPS у PHP, справжній PHP CLI-path, DB host/user, cURL/CA, ресурсні ліміти й перший реальний scan. Percona Server 8.4 на хостингу без доступу не тестувався; SQL використовує стандартний MySQL InnoDB синтаксис.
