<?php
declare(strict_types=1);
namespace TenderPro;
function config(): array {
    static $config;
    if ($config === null) {
        $path = defined('TENDERPRO_CONFIG_PATH') ? constant('TENDERPRO_CONFIG_PATH') : getenv('TENDERPRO_CONFIG');
        if (!$path || !is_file($path)) throw new \RuntimeException('Private server configuration missing');
        $config = require $path;
    }
    return $config;
}
function db(): \PDO {
    static $db;
    $c = config();
    if($db===null){
        $db=new \PDO($c['dsn'], $c['user'], $c['password'], [\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION, \PDO::ATTR_EMULATE_PREPARES=>false, \PDO::ATTR_TIMEOUT=>5]);
        $db->exec("SET time_zone='+00:00'");
        if(defined('TENDERPRO_EXPECTED_DATABASE') && $db->query('SELECT DATABASE()')->fetchColumn()!==constant('TENDERPRO_EXPECTED_DATABASE')){
            $db=null;
            throw new \RuntimeException('Configured database does not match deployment target');
        }
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
