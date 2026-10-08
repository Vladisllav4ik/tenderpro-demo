<?php
declare(strict_types=1);
try {
    if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
    require dirname(__DIR__).'/runtime.php';
    foreach(['curl','pdo_mysql','openssl','json'] as $extension)if(!extension_loaded($extension))throw new RuntimeException('Required extension missing');
    require dirname(__DIR__).'/app/src/config/bootstrap.php';
    $database=TenderPro\db()->query('SELECT DATABASE()')->fetchColumn();
    if($database!=='th604799_tenderpro')throw new RuntimeException('Wrong target database');
    $tables=TenderPro\db()->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    echo TenderPro\json(['ok'=>true,'php'=>PHP_VERSION,'sapi'=>PHP_SAPI,'extensions'=>'ok','database'=>$database,'tables'=>count($tables),'logsWritable'=>true]).PHP_EOL;
}catch(Throwable $error){error_log(json_encode(['operation'=>'adm-preflight','type'=>get_class($error),'code'=>$error->getCode()]));fwrite(STDERR,"Preflight failed; inspect private log and configuration\n");exit(1);}
