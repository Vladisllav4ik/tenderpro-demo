<?php
declare(strict_types=1);
require __DIR__.'/../src/config/bootstrap.php';
use function TenderPro\{db,json,config,dto,logError};
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
try {
    $local=in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true) && (config()['allow_local_http']??false);
    if(!$local && ($_SERVER['HTTPS']??'')!=='on') {http_response_code(426);echo json(['error'=>'HTTPS required']);exit;}
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){http_response_code(405);echo json(['error'=>'GET only']);exit;}
    $auth=$_SERVER['HTTP_AUTHORIZATION']??'';
    if(!preg_match('/^Bearer ([a-zA-Z0-9_-]{32,200})$/D',$auth,$m)){http_response_code(401);echo json(['error'=>'Unauthorized']);exit;}
    $q=db()->prepare('SELECT id FROM sync_clients WHERE token_hash=? AND enabled=1');$q->execute([hash('sha256',$m[1])]);$client=$q->fetchColumn();
    if(!$client){http_response_code(401);echo json(['error'=>'Unauthorized']);exit;}
    $q=db()->prepare('UPDATE sync_clients SET last_seen=CURRENT_TIMESTAMP WHERE id=?');$q->execute([$client]);
    $path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
    if($path==='/api/v1/health')echo json(['version'=>1,'status'=>'ok']);
    elseif($path==='/api/v1/scan-status')echo json(['version'=>1,'runs'=>db()->query('SELECT id,started_at,finished_at,state,statistics FROM collector_runs ORDER BY id DESC LIMIT 10')->fetchAll(PDO::FETCH_ASSOC)]);
    elseif($path==='/api/v1/tenders') {
        foreach(array_keys($_GET) as $key)if(!in_array($key,['cursor','limit'],true))throw new InvalidArgumentException('Unsupported query parameter');
        $cursor=$_GET['cursor']??'0';$limit=$_GET['limit']??'20';
        if(!is_string($cursor)||!ctype_digit($cursor)||strlen($cursor)>15||!is_string($limit)||!ctype_digit($limit)||(int)$limit<1||(int)$limit>50)throw new InvalidArgumentException('Invalid pagination');
        // Events include updates, unlike a tender-ID-only list. Stable snapshot per request.
        $q=db()->prepare('SELECT e.id,r.raw_json,r.content_hash FROM sync_events e JOIN tender_revisions r ON r.id=e.revision_id WHERE e.id>? ORDER BY e.id LIMIT ?');$q->bindValue(1,(int)$cursor,PDO::PARAM_INT);$q->bindValue(2,(int)$limit+1,PDO::PARAM_INT);$q->execute();$rows=$q->fetchAll(PDO::FETCH_ASSOC);$more=count($rows)>(int)$limit;$rows=array_slice($rows,0,(int)$limit);$records=[];$next=$cursor;$bytes=0;
        foreach($rows as $row){$record=dto(json_decode($row['raw_json'],true,512,JSON_THROW_ON_ERROR),$row['content_hash']);$size=strlen(json($record));if($size>2*1024*1024)throw new RuntimeException('Tender DTO exceeds response limit');if($bytes+$size>3500000){$more=true;break;}$records[]=$record;$bytes+=$size;$next=(string)$row['id'];}
        echo json(['version'=>1,'records'=>$records,'cursor'=>$next,'hasMore'=>$more]);
    }elseif(preg_match('#^/api/v1/tenders/([a-f0-9]{32})$#D',$path,$m)) {
        $q=db()->prepare('SELECT payload,content_hash FROM tenders WHERE id=?');$q->execute([$m[1]]);$row=$q->fetch(PDO::FETCH_ASSOC);
        if(!$row){http_response_code(404);echo json(['error'=>'Not found']);}else echo json(dto(json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR),$row['content_hash']));
    }else {http_response_code(404);echo json(['error'=>'Not found']);}
}catch(InvalidArgumentException $e){http_response_code(400);echo json(['error'=>'Invalid request parameters']);}
catch(Throwable $e){logError('api',$e);http_response_code(500);echo json(['error'=>'Server request failed']);}
