<?php
declare(strict_types=1);
try {
    require __DIR__.'/runtime.php';
    if(empty($_SERVER['HTTP_AUTHORIZATION']))$_SERVER['HTTP_AUTHORIZATION']=$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'';
    require __DIR__.'/app/api/index.php';
}catch(Throwable $error){
    error_log(json_encode(['operation'=>'adm-api-bootstrap','type'=>get_class($error),'code'=>$error->getCode()]));
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo '{"error":"Server configuration unavailable"}';
}
