<?php
declare(strict_types=1);
try {
    if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
    require dirname(__DIR__).'/runtime.php';
    set_time_limit(90);
    require dirname(__DIR__).'/app/cron/collect.php';
}catch(Throwable $error){
    error_log(json_encode(['operation'=>'adm-collector-bootstrap','type'=>get_class($error),'code'=>$error->getCode()]));
    fwrite(STDERR,"Collector configuration failed; inspect private log\n");
    exit(1);
}
