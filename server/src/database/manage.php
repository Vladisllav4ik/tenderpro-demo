<?php
declare(strict_types=1);
require __DIR__.'/../config/bootstrap.php';
use function TenderPro\{db,json};
try {
$action=$argv[1]??'';
if($action==='migrate') {
    db()->exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INT PRIMARY KEY,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    if(!db()->query('SELECT COUNT(*) FROM schema_migrations WHERE version=1')->fetchColumn())db()->exec(file_get_contents(__DIR__.'/../../migrations/001_collector.sql'));
    echo "Migration 1 applied\n";
}elseif($action==='profile') {
    $name=$argv[2]??'manual-test';$patterns=array_slice($argv,3);if(!$patterns)throw new RuntimeException('Provide approved test CPV patterns');
    foreach($patterns as $p)TenderPro\Cpv::pattern($p);
    db()->beginTransaction();
    $q=db()->prepare('INSERT INTO search_profiles(name) VALUES(?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');$q->execute([$name]);$id=(int)db()->lastInsertId();
    foreach($patterns as $p){$q=db()->prepare('INSERT IGNORE INTO cpv_filters(profile_id,pattern) VALUES(?,?)');$q->execute([$id,$p]);}
    db()->commit();echo json(['profileId'=>$id,'patterns'=>$patterns])."\n";
}elseif($action==='client') {
    $token=getenv('TENDERPRO_CLIENT_TOKEN');if(!$token||strlen($token)<32)throw new RuntimeException('Provide private token through environment');
    $q=db()->prepare('INSERT INTO sync_clients(id,token_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),enabled=1');$q->execute([$argv[2]??'desktop',hash('sha256',$token)]);echo "Client registered; token not printed\n";
}else throw new RuntimeException('Actions: migrate, profile NAME CPV..., client NAME');
}catch(Throwable $e){TenderPro\logError('database-management',$e);fwrite(STDERR,"Database management failed; check command, configuration and sanitized log\n");exit(1);}
