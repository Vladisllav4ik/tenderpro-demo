$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$zip=Join-Path $root '_temp/reports/TenderPro_ADM_stage3.1.zip'
$archive=[IO.Compression.ZipFile]::OpenRead($zip)
function ReadEntry($entry) {
    $reader=[IO.StreamReader]::new($entry.Open(),[Text.UTF8Encoding]::new($false),$true)
    try {$reader.ReadToEnd()}finally{$reader.Dispose()}
}
try {
    $entries=@{};foreach($entry in $archive.Entries){$entries[$entry.FullName]=$entry}
    $public=@($entries.Keys | Where-Object { $_.StartsWith('www/') })
    if($public.Count -ne 2 -or !$entries.ContainsKey('www/.htaccess') -or !$entries.ContainsKey('www/index.php')){throw 'Unexpected public files'}
    foreach($name in $entries.Keys){
        if($name -match '(^|/)(config\.php|php-cli\.path|\.env|node_modules|\.tenderpro-local|src-tauri|test-key\.pem|token\.txt)(/|$)' -or $name -match '\.(log|sqlite|db|exe)$'){throw "Forbidden package entry: $name"}
        $text=ReadEntry $entries[$name]
        $stream=$entries[$name].Open()
        try {$prefix=[byte[]]::new(3);$read=$stream.Read($prefix,0,3)}finally{$stream.Dispose()}
        $bom=$read -eq 3 -and $prefix[0] -eq 239 -and $prefix[1] -eq 187 -and $prefix[2] -eq 191
        if($text.Contains("`r") -or $bom){throw "BOM/CRLF in $name"}
    }
    $config=ReadEntry $entries['private/config.example.php']
    foreach($placeholder in @('REPLACE_DB_HOST','REPLACE_DB_USER','REPLACE_DB_PASSWORD','th604799_tenderpro')){if(!$config.Contains($placeholder)){throw "Missing config placeholder: $placeholder"}}
    $sql=ReadEntry $entries['private/app/migrations/001_empty_adm.sql']
    if($sql -match '\b(DROP|DELETE|TRUNCATE)\b' -or !$sql.Contains('USE `th604799_tenderpro`') -or ([regex]::Matches($sql,'ENGINE=InnoDB').Count -ne 11)){throw 'Unexpected migration'}
    $manifest=ReadEntry $entries['MANIFEST.sha256']
    foreach($line in $manifest.Trim().Split("`n")) {
        $hash,$name=$line -split '  ',2
        if(!$entries.ContainsKey($name)){throw "Missing manifest entry: $name"}
        $stream=$entries[$name].Open()
        try{$actual=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant()}finally{$stream.Dispose()}
        if($actual -ne $hash){throw "Hash mismatch: $name"}
    }
    if($manifest.Trim().Split("`n").Count -ne $entries.Count-1){throw 'Incomplete manifest'}
    Write-Output "PASS ZIP: $($entries.Count) files, public allowlist, no secret files, LF/no BOM, SQL and SHA256 manifest"
}finally{$archive.Dispose()}
