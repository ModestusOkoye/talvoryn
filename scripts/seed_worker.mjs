// Imports already checked, dated public datasets; does not upload RPC archives.
import {readFile} from 'node:fs/promises';
const origin=process.env.TALVORYN_WORKER_URL,token=process.env.OWNER_API_TOKEN;
if(!origin||!token||new URL(origin).protocol!=='https:')throw Error('Set HTTPS TALVORYN_WORKER_URL and OWNER_API_TOKEN outside Git');
const performance=JSON.parse(await readFile('dist/data/performance.json','utf8'));
const sources=Object.fromEntries(await Promise.all(['performance','supply-history','supply-daily','research-models','near-raw','btc-raw','eth-raw','economic-catalysts','catalysts','catalyst-explanations','altcoin-total','whales','supply-head'].map(async name=>[name,JSON.parse(await readFile('dist/data/'+name+'.json','utf8'))])));
sources['integrators-data']=JSON.parse(await readFile('dist/integrators-data.json','utf8'));
sources.buybacks={daily:Object.fromEntries(performance.daily.filter(r=>Number.isFinite(r.buy)).map(r=>[r.date,r.buy])),throughExclusive:new Date(Date.parse(performance.meta.through)+86400000).toISOString().slice(0,10)};
for(const [name,value]of Object.entries(sources)){const r=await fetch(new URL('/api/admin/import/'+name,origin),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(value),redirect:'error'});if(!r.ok)throw Error(name+' import failed: '+r.status);console.log(name,'imported')}
