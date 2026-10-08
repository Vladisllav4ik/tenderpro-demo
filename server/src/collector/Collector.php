<?php
declare(strict_types=1);
namespace TenderPro;
final class Collector {
    public function __construct(private \PDO $db,private SourceConnector $source) {}
    public function run(int $profile,string $mode,int $limit=20,int $seconds=60,bool $repeat=false): array {
        if(!in_array($mode,['recent','forward'],true)||$limit<1||$limit>200||$seconds<1||$seconds>120)throw new \InvalidArgumentException('Invalid scan bounds');
        $lock=$this->db->prepare('SELECT GET_LOCK(?,0)');$lock->execute(['tenderpro-collector']);
        if((int)$lock->fetchColumn()!==1)throw new \RuntimeException('Collector already running');
        $stats=['source'=>$this->source->identity(),'ids'=>0,'details'=>0,'cpv'=>0,'matched'=>0,'new'=>0,'updated'=>0,'duplicates'=>0,'errors'=>0];
        $run=null;$state=[];$started=microtime(true);
        if($this->source instanceof Prozorro)$this->source->deadline($started+$seconds);
        try {
            $q=$this->db->prepare('SELECT pattern FROM cpv_filters f JOIN search_profiles p ON p.id=f.profile_id WHERE f.profile_id=? AND f.enabled=1 AND p.enabled=1');$q->execute([$profile]);$patterns=$q->fetchAll(\PDO::FETCH_COLUMN);
            if(!$patterns)throw new \RuntimeException('No enabled CPV filters');
            foreach($patterns as $p)Cpv::pattern($p);
            $q=$this->db->prepare('SELECT state_json FROM collector_state WHERE profile_id=? AND mode=?');$q->execute([$profile,$mode]);
            $saved=$q->fetchColumn();$state=$saved?json_decode($saved,true,512,JSON_THROW_ON_ERROR):['offset'=>null,'pending'=>[],'index'=>0];
            // Explicit repeat scans the captured initial page, not a moving live head.
            if($repeat){if(empty($state['initial']))throw new \RuntimeException('No initial page to repeat');$state['pending']=$state['initial'];$state['index']=0;$state['next']=$state['initial_next'];}
            if($mode==='forward' && $state['offset']===null && !$state['pending']) {
                $head=$this->source->feed(null,true);
                $state['offset']=$head['prev_page']['offset']??throw new \RuntimeException('Forward watermark missing');
                $this->saveState($profile,$mode,$state);
            }
            $q=$this->db->prepare("INSERT INTO collector_runs(profile_id,state,statistics) VALUES(?,'running',?)");$q->execute([$profile,json($stats)]);$run=(int)$this->db->lastInsertId();
            while($stats['details']<$limit && microtime(true)-$started<$seconds) {
                if($state['index']>=count($state['pending'])) {
                    $page=$this->source->feed($state['offset'],$mode==='recent');
                    if(!is_array($page['data']??null))throw new \RuntimeException('Feed data missing');
                    $state['pending']=$page['data'];$state['index']=0;$state['next']=$page['next_page']['offset']??throw new \RuntimeException('Cursor missing');
                    if($mode==='recent' && empty($state['initial']) && isset($page['prev_page']['offset'])) {
                        // Capture the forward watermark now, not on the first later Cron run.
                        $q=$this->db->prepare("INSERT IGNORE INTO collector_state VALUES(?,'forward',?)");
                        $q->execute([$profile,json(['offset'=>$page['prev_page']['offset'],'pending'=>[],'index'=>0])]);
                    }
                    if(empty($state['initial']) && $state['pending']) {$state['initial']=$state['pending'];$state['initial_next']=$state['next'];}
                    $this->saveState($profile,$mode,$state);
                    if(!$state['pending']) {$state['offset']=$state['next'];$this->saveState($profile,$mode,$state);break;}
                }
                $entry=$state['pending'][$state['index']];$stats['ids']++;
                // Failure leaves index on the failed record. Next invocation retries it.
                $raw=$this->source->detail($entry['id']);$stats['details']++;
                $codes=Cpv::codes($raw);$stats['cpv']+=count($codes);$matches=Cpv::matches($codes,$patterns);
                $this->db->beginTransaction();
                try {
                    $result=$matches?$this->persist($raw,$matches):null;
                    $state['index']++;
                    if($state['index']===count($state['pending']))$state['offset']=$state['next'];
                    $this->saveState($profile,$mode,$state);
                    $this->db->commit();
                    if($result!==null){$stats['matched']++;$stats[$result]++;}
                }catch(\Throwable $e){$this->db->rollBack();throw $e;}
            }
            $stats['cursor']=$state;$stats['state']='bounded';
        }catch(\Throwable $e){$stats['errors']++;$stats['state']='error';$stats['cursor']=$state;logError('collector',$e);}
        finally {
            if($run!==null){$q=$this->db->prepare('UPDATE collector_runs SET finished_at=CURRENT_TIMESTAMP,state=?,statistics=? WHERE id=?');$q->execute([$stats['state'],json($stats),$run]);}
            $this->db->query("SELECT RELEASE_LOCK('tenderpro-collector')");
        }
        $stats['runId']=$run;return $stats;
    }
    private function saveState(int $profile,string $mode,array $state): void {
        $q=$this->db->prepare('INSERT INTO collector_state VALUES(?,?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)');$q->execute([$profile,$mode,json($state)]);
    }
    private function persist(array $raw,array $matches): string {
        $id=$raw['id'];$hash=hash('sha256',json($this->canonical($raw)));
        $q=$this->db->prepare('SELECT content_hash,date_modified FROM tenders WHERE id=?');$q->execute([$id]);$old=$q->fetch(\PDO::FETCH_ASSOC);
        if($old && ($old['content_hash']===$hash || new \DateTimeImmutable($old['date_modified'])>=new \DateTimeImmutable($raw['dateModified'])))return 'duplicates';
        $q=$this->db->prepare('INSERT INTO tenders(id,public_id,title,cpv,date_modified,source_status,payload,content_hash) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),cpv=VALUES(cpv),date_modified=VALUES(date_modified),source_status=VALUES(source_status),payload=VALUES(payload),content_hash=VALUES(content_hash)');
        $q->execute([$id,$raw['tenderID'],$raw['title']??'',Cpv::codes($raw)[0]??null,$raw['dateModified'],$raw['status']??null,json($raw),$hash]);
        $q=$this->db->prepare("INSERT INTO tender_sources(tender_id,source,external_id,date_modified) VALUES(?,'prozorro',?,?) ON DUPLICATE KEY UPDATE date_modified=VALUES(date_modified)");$q->execute([$id,$id,$raw['dateModified']]);
        $q=$this->db->prepare('INSERT INTO tender_revisions(tender_id,content_hash,raw_json,matched_filters) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');$q->execute([$id,$hash,json($raw),json($matches)]);$revision=(int)$this->db->lastInsertId();
        $q=$this->db->prepare('DELETE FROM tender_items WHERE tender_id=?');$q->execute([$id]);
        foreach($raw['items']??[] as $i=>$item){$q=$this->db->prepare('INSERT INTO tender_items VALUES(?,?,?,?)');$q->execute([$id,(string)($item['id']??$i),Cpv::codes($item)[0]??null,json($item)]);}
        $q=$this->db->prepare('INSERT INTO sync_events(tender_id,revision_id) VALUES(?,?)');$q->execute([$id,$revision]);
        return $old?'updated':'new';
    }
    private function canonical(mixed $value): mixed {
        if(!is_array($value))return $value;
        if(!array_is_list($value))ksort($value,SORT_STRING);
        foreach($value as &$item)$item=$this->canonical($item);
        return $value;
    }
}
