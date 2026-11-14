// Explicit network integration test; never run implicitly in the unit suite.
import {LocalD1} from '../tests/recovery/sqlite-d1.mjs';
import worker from '../worker/production.mjs';
import {read,write,health} from '../worker/storage.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const directory=process.env.TALVORYN_TEST_DIR||'.qa';await mkdir(directory,{recursive:true});
let db=new LocalD1(directory+'/scheduled.sqlite');db.sqlite.exec(await readFile('migrations/0001_ingestion.sql','utf8'));
const baseline=JSON.parse(await readFile('dist/data/performance.json','utf8'));
if(!await read(db,'performance'))await write(db,'performance',baseline,baseline.meta.through);
if(!await read(db,'buybacks'))await write(db,'buybacks',{daily:Object.fromEntries(baseline.daily.filter(r=>Number.isFinite(r.buy)).map(r=>[r.date,r.buy])),throughExclusive:new Date(Date.parse(baseline.meta.through)+86400000).toISOString().slice(0,10)});
if(!await read(db,'whales'))await write(db,'whales',JSON.parse(await readFile('dist/data/whales.json','utf8')));
const event={scheduledTime:Date.now(),cron:'7 * * * *'};
const result=await worker.scheduled(event,{DB:db});const first=await read(db,'activity');if(!first?.volume?.through)throw Error('No actual source activity persisted');db.close();
db=new LocalD1(directory+'/scheduled.sqlite');const persisted=await read(db,'activity');if(JSON.stringify(first)!==JSON.stringify(persisted))throw Error('Persistence/reopen mismatch');const report={test:'direct scheduled-handler invocation with live provider requests and disk SQLite adapter; not a deployed Cron run',executedAt:new Date().toISOString(),event,result,sourceHealth:await health(db),persistenceReopen:'passed'};await writeFile(directory+'/scheduled-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));db.close();
