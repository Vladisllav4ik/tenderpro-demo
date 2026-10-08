<?php
declare(strict_types=1);
namespace TenderPro;
function config(): array {
    static $config;
    if ($config === null) {
        $path = getenv('TENDERPRO_CONFIG');
        if (!$path || !is_file($path)) throw new \RuntimeException('Private server configuration missing');
        $config = require $path;
    }
    return $config;
}
function db(): \PDO {
    static $db;
    $c = config();
    if($db===null){
        $db=new \PDO($c['dsn'], $c['user'], $c['password'], [\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION, \PDO::ATTR_EMULATE_PREPARES=>false]);
        $db->exec("SET time_zone='+00:00'");
    }
    return $db;
}
function json(mixed $data): string { return json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); }
function logError(string $operation, \Throwable $error): void {
    // Never log exception messages: PDO/network errors may contain credentials or headers.
    error_log(json(['time'=>gmdate('c'), 'operation'=>$operation, 'type'=>get_class($error), 'code'=>$error->getCode()]));
}
require_once __DIR__.'/../filters/Cpv.php';
require_once __DIR__.'/../sources/Prozorro.php';
require_once __DIR__.'/../collector/Collector.php';
require_once __DIR__.'/../sync/Dto.php';
