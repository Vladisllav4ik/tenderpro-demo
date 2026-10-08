<?php
declare(strict_types=1);
require __DIR__.'/../src/config/bootstrap.php';
use TenderPro\{Collector,Prozorro};
$options=getopt('', ['profile:','mode:','limit:','seconds:','repeat']);
try {$stats=(new Collector(TenderPro\db(),new Prozorro()))->run((int)($options['profile']??1),$options['mode']??'forward',(int)($options['limit']??20),(int)($options['seconds']??60),isset($options['repeat']));}
catch(Throwable $e){TenderPro\logError('collector-bootstrap',$e);fwrite(STDERR,"Collector initialization failed; inspect sanitized server log\n");exit(1);}
echo TenderPro\json($stats).PHP_EOL;
exit($stats['errors']?1:0);
