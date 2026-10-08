import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base = process.env.TENDERPRO_API_URL;
const token = process.env.TENDERPRO_CLIENT_TOKEN;
assert.ok(base && token, 'Provide private API URL and client token environment variables');
const get = (path, auth = token) => fetch(new URL(path, base), { headers: { Authorization: `Bearer ${auth}` } });
assert.equal((await get('/api/v1/health', 'invalid')).status, 401);
assert.equal((await get('/api/v1/tenders?cursor=bad')).status, 400);
assert.equal((await get('/api/v1/tenders?limit=500')).status, 400);
assert.equal((await get('/api/v1/tenders?cursor[]=0')).status, 400);
assert.equal((await get('/api/v1/tenders/00000000000000000000000000000000')).status, 404);
assert.equal((await (await get('/api/v1/health')).json()).status, 'ok');
let cursor = '0'; const records = [];
for (let i = 0; i < 200; i++) {
  const response = await get(`/api/v1/tenders?cursor=${cursor}&limit=1`);
  assert.equal(response.status, 200);
  const page = await response.json(); assert.equal(page.version, 1);
  assert.ok(BigInt(page.cursor) >= BigInt(cursor));
  for (const record of page.records) {
    assert.match(record.id, /^[a-f0-9]{32}$/); assert.match(record.publicId, /^UA-/);
    assert.equal(record.source, 'prozorro'); assert.ok(Array.isArray(record.cpv));
    assert.ok(record.cpv.length); records.push(record);
  }
  cursor = page.cursor;
  if (!page.hasMore) break;
  assert.equal(page.records.length, 1);
}
assert.ok(records.length > 0, 'Requires real collected records');
const detail = await (await get(`/api/v1/tenders/${records[0].id}`)).json();
assert.equal(detail.publicId, records[0].publicId);
const tail = await (await get(`/api/v1/tenders?cursor=${cursor}`)).json();
assert.equal(tail.records.length, 0);
const status = await (await get('/api/v1/scan-status')).json();
assert.ok(status.runs.length > 0);
const result = { passed: true, events: records.length, uniqueTenders: new Set(records.map(r => r.id)).size, cursor, records };
await writeFile('_temp/reports/stage3-api.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: true, events: result.events, uniqueTenders: result.uniqueTenders, cursor }));
