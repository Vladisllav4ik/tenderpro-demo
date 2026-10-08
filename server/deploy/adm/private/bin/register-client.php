<?php
declare(strict_types=1);
// File-manager-friendly token registration: only a precomputed hash is needed.
try {
    if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
    require dirname(__DIR__).'/runtime.php';
    require dirname(__DIR__).'/app/src/config/bootstrap.php';
    $id=$argv[1]??'';$hash=$argv[2]??'';
    if(!preg_match('/^[A-Za-z0-9_-]{1,120}$/D',$id)||!preg_match('/^[a-f0-9]{64}$/D',$hash))throw new InvalidArgumentException('Provide DEVICE-ID SHA256-HASH');
    $q=TenderPro\db()->prepare('INSERT INTO sync_clients(id,token_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),enabled=1');$q->execute([$id,$hash]);
    echo "Client registered; no token stored or printed\n";
}catch(Throwable $error){error_log(json_encode(['operation'=>'adm-register-client','type'=>get_class($error),'code'=>$error->getCode()]));fwrite(STDERR,"Client registration failed\n");exit(1);}
