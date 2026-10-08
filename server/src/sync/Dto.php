<?php
declare(strict_types=1);
namespace TenderPro;
function dto(array $raw,string $hash): array {
    return ['version'=>1,'source'=>'prozorro','id'=>$raw['id'],'publicId'=>$raw['tenderID'],'revision'=>$hash,'dateModified'=>$raw['dateModified'],
        'title'=>$raw['title']??null,'customer'=>$raw['procuringEntity']['name']??null,'cpv'=>Cpv::codes($raw),
        'publishedAt'=>$raw['dateCreated']??null,'submissionEnd'=>$raw['tenderPeriod']['endDate']??null,
        'value'=>$raw['value']??null,'status'=>$raw['status']??null,'url'=>'https://prozorro.gov.ua/uk/tender/'.$raw['tenderID'],
        'items'=>$raw['items']??[], 'documents'=>$raw['documents']??[]];
}
