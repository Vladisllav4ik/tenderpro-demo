<?php
// Copy OUTSIDE the HTTP document root; TENDERPRO_CONFIG is its absolute path.
return [
    'dsn'=>'mysql:host=127.0.0.1;port=3306;dbname=tenderpro;charset=utf8mb4',
    'user'=>'tenderpro', 'password'=>'REPLACE_PRIVATELY',
    'allow_local_http'=>false,
    // Optional CA bundle path. TLS verification is always enabled.
    'ca_file'=>null,
];
