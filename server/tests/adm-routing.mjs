import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base=process.env.TENDERPRO_API_URL;
const token=process.env.TENDERPRO_CLIENT_TOKEN;
assert.ok(base && token,'Private test URL/token must be supplied');
const get=(path,auth=true)=>fetch(new URL(path,base),{redirect:'manual',headers:auth?{Authorization:`Bearer ${token}`}:{}});
const outcomes=[];
async function status(path,expected,auth=true){const r=await get(path,auth);assert.equal(r.status,expected,path);outcomes.push({path,status:r.status});return r;}
assert.deepEqual(await (await status('/api/v1/health',200)).json(),{version:1,status:'ok'});
await status('/api/v1/health',401,false);
const list=await (await status('/api/v1/tenders?cursor=0&limit=1',200)).json();assert.equal(list.version,1);assert.ok(Array.isArray(list.records));
const runs=await (await status('/api/v1/scan-status',200)).json();assert.equal(runs.version,1);assert.ok(Array.isArray(runs.runs));
await status('/api/v1/tenders?cursor=bad',400);
await status('/api/v1/tenders?limit=500',400);
await status('/api/v1/tenders/00000000000000000000000000000000',404);
await status('/api/v1/unknown',404);
for(const path of ['/private/config.php','/server/src/config/bootstrap.php','/logs/php-error.log','/.env','/.htaccess']) {
  const r=await get(path,false);assert.ok([403,404].includes(r.status),path);const body=await r.text();assert.ok(!body.includes('<?php'));outcomes.push({path,status:r.status});
}
const post=await fetch(new URL('/api/v1/health',base),{method:'POST',headers:{Authorization:`Bearer ${token}`}});assert.equal(post.status,405);
const redirect=await fetch('http://127.0.0.1:8093/api/v1/health?check=1',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'https://api-tenderpro.solomons.com.ua/api/v1/health?check=1');
const result={passed:true,mode:process.env.ADM_TEST_MODE??'apache',outcomes,postStatus:post.status,redirectStatus:redirect.status};
await writeFile(`_temp/reports/adm31-routing-${result.mode}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:true,mode:result.mode,checks:outcomes.length+2}));
