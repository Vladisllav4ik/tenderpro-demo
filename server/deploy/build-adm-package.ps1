$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$staging = Join-Path $workspace ('_temp/other/adm31-package-' + [Guid]::NewGuid().ToString('N'))
$output = Join-Path $workspace '_temp/reports/TenderPro_ADM_stage3.1.zip'
New-Item -ItemType Directory -Force $staging,(Split-Path $output) | Out-Null
foreach($relative in @('www/index.php','www/.htaccess','private/runtime.php','private/api.php','private/config.example.php','private/php-cli.example','private/logs/.keep','private/state/.keep','private/cron/collect.php','private/cron/first-scan.php','private/cron/run.sh','private/bin/manage.php','private/bin/preflight.php','private/bin/register-client.php')) {
    $target=Join-Path $staging $relative
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    Copy-Item -LiteralPath (Join-Path "$PSScriptRoot/adm" $relative) -Destination $target
}
$app = Join-Path $staging 'private/app'
New-Item -ItemType Directory -Force "$app/api","$app/cron","$app/migrations","$app/src" | Out-Null
# Explicit allowlist: never copy .env, local configs, tests, data, logs or secrets.
Copy-Item -LiteralPath (Join-Path $workspace 'server/api/index.php') -Destination "$app/api/index.php"
Copy-Item -LiteralPath (Join-Path $workspace 'server/cron/collect.php') -Destination "$app/cron/collect.php"
foreach($relative in @('config/bootstrap.php','filters/Cpv.php','sources/Prozorro.php','collector/Collector.php','sync/Dto.php','database/manage.php')) {
    $target=Join-Path "$app/src" $relative
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    Copy-Item -LiteralPath (Join-Path "$workspace/server/src" $relative) -Destination $target
}
$migration = [System.IO.File]::ReadAllText((Join-Path $workspace 'server/migrations/001_collector.sql'))
$migration = $migration.Replace('CREATE TABLE IF NOT EXISTS','CREATE TABLE')
$migration = $migration -replace '\);',') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
# The rewrite above applies to DDL only; INSERT ends in VALUES(1), so restore it.
$migration = $migration.Replace('VALUES(1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;','VALUES(1);')
$migration = $migration.Replace('CREATE TABLE schema_migrations','CREATE TABLE IF NOT EXISTS schema_migrations')
$migration="-- ADM / Percona 8.4: import ONLY into the empty th604799_tenderpro database.`nSET NAMES utf8mb4;`nUSE ``th604799_tenderpro``;`n"+$migration
[System.IO.File]::WriteAllText("$app/migrations/001_empty_adm.sql",$migration,[System.Text.UTF8Encoding]::new($false))
# manage.php expects this filename; both SQL files are the same migration, not two steps.
[System.IO.File]::WriteAllText("$app/migrations/001_collector.sql",$migration,[System.Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'ADM_DEPLOY.md') -Destination (Join-Path $staging 'ADM_DEPLOY.md')
Copy-Item -LiteralPath (Join-Path $workspace 'docs/testing/ADM_DEPLOY_PACKAGE_RESULTS.md') -Destination (Join-Path $staging 'ADM_PACKAGE_CHECKS.md')
$checksPath=Join-Path $staging 'ADM_PACKAGE_CHECKS.md'
[IO.File]::WriteAllText($checksPath,[IO.File]::ReadAllText($checksPath).Replace('../../server/deploy/ADM_DEPLOY.md','ADM_DEPLOY.md'),[Text.UTF8Encoding]::new($false))
# Linux PHP/shell files must have LF and no UTF-8 BOM.
Get-ChildItem -LiteralPath $staging -Recurse -File -Force | ForEach-Object {
    $text=[System.IO.File]::ReadAllText($_.FullName).Replace("`r`n","`n").TrimStart([char]0xFEFF)
    [System.IO.File]::WriteAllText($_.FullName,$text,[System.Text.UTF8Encoding]::new($false))
}
$manifest=Get-ChildItem -LiteralPath $staging -Recurse -File -Force | Sort-Object FullName | ForEach-Object {
    $relative=[System.IO.Path]::GetRelativePath($staging,$_.FullName).Replace('\','/')
    (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()+'  '+$relative
}
[System.IO.File]::WriteAllText((Join-Path $staging 'MANIFEST.sha256'),($manifest -join "`n")+"`n",[System.Text.UTF8Encoding]::new($false))
Add-Type -AssemblyName System.IO.Compression
$stream=[System.IO.File]::Open($output,[System.IO.FileMode]::Create)
try {
    $archive=[System.IO.Compression.ZipArchive]::new($stream,[System.IO.Compression.ZipArchiveMode]::Create,$false)
    try {
        Get-ChildItem -LiteralPath $staging -Recurse -File -Force | Sort-Object FullName | ForEach-Object {
            $name=[System.IO.Path]::GetRelativePath($staging,$_.FullName).Replace('\','/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$_.FullName,$name,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally {$archive.Dispose()}
} finally {$stream.Dispose()}
Write-Output "ZIP: $output"
Write-Output "STAGING: $staging"
[System.IO.File]::WriteAllText((Join-Path $workspace '_temp/reports/adm31-package-path.txt'),$staging,[System.Text.UTF8Encoding]::new($false))
Get-FileHash -LiteralPath $output -Algorithm SHA256 | Select-Object Hash,Path
