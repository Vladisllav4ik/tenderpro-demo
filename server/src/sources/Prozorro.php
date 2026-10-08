<?php
declare(strict_types=1);
namespace TenderPro;
interface SourceConnector {
    public function identity(): string;
    public function feed(?string $offset, bool $descending): array;
    public function detail(string $id): array;
}
final class Prozorro implements SourceConnector {
    private float $until=PHP_FLOAT_MAX;
    public function deadline(float $until): void {$this->until=$until;}
    public function identity(): string { return 'prozorro'; }
    public function feed(?string $offset, bool $descending): array {
        $query=['limit'=>20];
        if ($descending) $query['descending']=1;
        if ($offset!==null) $query['offset']=$offset;
        return $this->get('/tenders?'.http_build_query($query));
    }
    public function detail(string $id): array {
        if(!preg_match('/^[a-f0-9]{32}$/D',$id)) throw new \InvalidArgumentException('Invalid canonical ID');
        $data=$this->get('/tenders/'.$id)['data']??null;
        if(!is_array($data) || ($data['id']??null)!==$id || !preg_match('/^UA-\d{4}-\d{2}-\d{2}-\d+-[a-z]$/D',$data['tenderID']??'')) throw new \RuntimeException('Invalid tender response');
        return $data;
    }
    private function get(string $path): array {
        for($attempt=0;$attempt<3;$attempt++) {
            $remaining=$this->until-microtime(true);
            if($remaining<0.1)throw new \RuntimeException('Scan time budget exhausted');
            $ch=curl_init('https://public-api.prozorro.gov.ua/api/2.5'.$path);
            $body='';
            curl_setopt_array($ch,[CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>12,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_USERAGENT=>'TenderPro-Collector/1',CURLOPT_WRITEFUNCTION=>static function($ch,$chunk) use (&$body) { if(strlen($body)+strlen($chunk)>8*1024*1024)return 0; $body.=$chunk;return strlen($chunk); }]);
            curl_setopt($ch,CURLOPT_TIMEOUT_MS,(int)(min(12,$remaining)*1000));
            if(!empty(config()['ca_file'])) curl_setopt($ch,CURLOPT_CAINFO,config()['ca_file']);
            $ok=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);
            if($ok && $status===200) { $result=json_decode($body,true,512,JSON_THROW_ON_ERROR); if(!is_array($result))throw new \RuntimeException('Invalid API JSON'); return $result; }
            if($attempt===2 || ($status>=400 && $status<500 && $status!==429))throw new \RuntimeException('Prozorro request failed', $status);
            usleep(250000*(2**$attempt));
        }
        throw new \RuntimeException('Prozorro retry exhausted');
    }
}
// Broker connectors implement SourceConnector only after an API access agreement.
// No scraping, fabricated feed or silent fallback is provided.
