<?php
declare(strict_types=1);
try {
    if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
    require dirname(__DIR__).'/runtime.php';
    require dirname(__DIR__).'/app/src/database/manage.php';
}catch(Throwable $error){
    error_log(json_encode(['operation'=>'adm-management-bootstrap','type'=>get_class($error),'code'=>$error->getCode()]));
    fwrite(STDERR,"Management configuration failed; inspect private log\n");exit(1);
}
