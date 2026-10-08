<?php
declare(strict_types=1);
try {
    if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
    require dirname(__DIR__).'/runtime.php';
    require dirname(__DIR__).'/app/src/config/bootstrap.php';
    $state=dirname(__DIR__).'/state';
    $lock=fopen($state.'/first-scan.lock','c');
    if(!$lock || !flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('First scan already running');
    if(is_file($state.'/first-scan.done')){echo "First scan already completed; no requests made\n";exit(0);}
    $result=(new TenderPro\Collector(TenderPro\db(),new TenderPro\Prozorro()))->run(1,'recent',20,60);
    echo TenderPro\json($result).PHP_EOL;
    if($result['errors'])exit(1);
    file_put_contents($state.'/first-scan.done',TenderPro\json(['completedAt'=>gmdate('c'),'runId'=>$result['runId']]));
}catch(Throwable $error){error_log(json_encode(['operation'=>'adm-first-scan','type'=>get_class($error),'code'=>$error->getCode()]));fwrite(STDERR,"First scan failed; inspect private log\n");exit(1);}
