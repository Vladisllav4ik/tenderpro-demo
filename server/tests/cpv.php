<?php
declare(strict_types=1);
require __DIR__.'/../src/filters/Cpv.php';
use TenderPro\Cpv;
function check(bool $condition,string $label): void {if(!$condition)throw new RuntimeException($label);echo "PASS $label\n";}
check(count(Cpv::matches(['43262100-8','34223300-9'],['4326*','34223300-9']))===2,'prefix and exact');
check(Cpv::matches(['43262100-8'],['43262200-9'])===[],'no false match');
foreach(['%','4326%','4326* OR 1=1','123','abcdefgh-1'] as $invalid){try{Cpv::pattern($invalid);throw new RuntimeException('accepted invalid');}catch(InvalidArgumentException){echo "PASS reject invalid\n";}}
check(Cpv::codes(['classification'=>['scheme'=>'CPV','id'=>'43262100-8'],'items'=>[['classification'=>['scheme'=>'ДК021','id'=>'34223300-9']]]])===['43262100-8','34223300-9'],'root and item CPV');
