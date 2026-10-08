<?php
declare(strict_types=1);
namespace TenderPro;
final class Cpv {
    public static function pattern(string $value): string {
        $value=trim($value);
        if (!preg_match('/^(?:\d{8}-\d|\d{2,8}\*)$/D', $value)) throw new \InvalidArgumentException('Invalid CPV pattern');
        return $value;
    }
    public static function codes(array $raw): array {
        $codes=[];
        foreach (array_merge([$raw],$raw['items']??[]) as $item) {
            $c=$item['classification']??[];
            if (in_array($c['scheme']??'', ['CPV','ДК021'], true) && preg_match('/^\d{8}-\d$/D', $c['id']??'')) $codes[]=$c['id'];
        }
        return array_values(array_unique($codes));
    }
    public static function matches(array $codes,array $patterns): array {
        $matches=[];
        foreach ($patterns as $pattern) {
            $pattern=self::pattern($pattern);
            foreach($codes as $code) if (str_ends_with($pattern,'*') ? str_starts_with($code,substr($pattern,0,-1)) : $code===$pattern) $matches[]=['filter'=>$pattern,'cpv'=>$code];
        }
        return $matches;
    }
}
