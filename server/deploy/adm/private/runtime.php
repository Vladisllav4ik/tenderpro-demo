<?php
declare(strict_types=1);
ini_set('display_errors','0');
ini_set('display_startup_errors','0');
ini_set('log_errors','1');
ini_set('zend.exception_ignore_args','1');
ini_set('memory_limit','128M');
ini_set('error_log',__DIR__.'/logs/php-error.log');
error_reporting(E_ALL);
date_default_timezone_set('UTC');
if(PHP_VERSION_ID<80300 || PHP_VERSION_ID>=90000)throw new RuntimeException('PHP 8.3+ required');
if(!is_dir(__DIR__.'/logs') || !is_writable(__DIR__.'/logs'))throw new RuntimeException('Private log directory unavailable');
define('TENDERPRO_CONFIG_PATH',__DIR__.'/config.php');
define('TENDERPRO_EXPECTED_DATABASE','th604799_tenderpro');
// Turn PHP warnings into sanitized exceptions; never emit raw paths/SQL.
set_error_handler(static function(int $level,string $message,string $file,int $line):bool {
    if(!(error_reporting() & $level))return false;
    throw new ErrorException('PHP runtime warning',0,$level);
});
