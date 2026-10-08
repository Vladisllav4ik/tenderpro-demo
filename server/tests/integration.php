<?php
declare(strict_types=1);
// Requires an isolated migrated MySQL database and real network access.
// It creates a separate test search profile; no existing tenders are removed.
require __DIR__.'/../src/config/bootstrap.php';
use TenderPro\{Collector,Prozorro,SourceConnector};
use function TenderPro\{db,json};
function check(bool $ok,string $label): void {if(!$ok)throw new RuntimeException($label);echo "PASS $label\n";}
$q=db()->prepare('INSERT INTO search_profiles(name) VALUES(?)');$q->execute(['resume-test-'.bin2hex(random_bytes(4))]);$profile=(int)db()->lastInsertId();
foreach(['30*','44*'] as $p){$q=db()->prepare('INSERT INTO cpv_filters(profile_id,pattern) VALUES(?,?)');$q->execute([$profile,$p]);}
$source=new class implements SourceConnector {
    private Prozorro $source; private int $details=0;
    public function __construct(){$this->source=new Prozorro();}
    public function identity():string{return 'prozorro';}
    public function feed(?string $offset,bool $descending):array{return $this->source->feed($offset,$descending);}
    public function detail(string $id):array {if(++$this->details===2)throw new RuntimeException('Controlled interruption before second detail');return $this->source->detail($id);}
};
$first=(new Collector(db(),$source))->run($profile,'recent',3,30);
check($first['details']===1 && $first['errors']===1,'controlled interruption after a real API record');
$q=db()->prepare("SELECT state_json FROM collector_state WHERE profile_id=? AND mode='recent'");$q->execute([$profile]);$state=json_decode($q->fetchColumn(),true);
check($state['index']===1,'failed record remains pending in MySQL');$failedId=$state['pending'][1]['id'];
$resumed=(new Collector(db(),new Prozorro()))->run($profile,'recent',1,30);
check($resumed['errors']===0 && $resumed['details']===1 && $resumed['cursor']['index']===2,'new collector instance resumes failed record');
check($resumed['cursor']['pending'][1]['id']===$failedId,'no skipped ID');
file_put_contents(__DIR__.'/../../_temp/reports/stage3-resume.json',json(['interrupted'=>$first,'resumed'=>$resumed]));
$samples=[];
foreach(db()->query('SELECT payload,content_hash FROM tenders ORDER BY public_id LIMIT 10')->fetchAll(PDO::FETCH_ASSOC) as $row)$samples[]=TenderPro\dto(json_decode($row['payload'],true),$row['content_hash']);
check(count($samples)>0,'real matched tenders persisted in MySQL');
file_put_contents(__DIR__.'/../../_temp/reports/stage3-real-tenders.json',json($samples));
echo json(['mysqlTenders'=>(int)db()->query('SELECT COUNT(*) FROM tenders')->fetchColumn(),'sampleCount'=>count($samples)])."\n";
