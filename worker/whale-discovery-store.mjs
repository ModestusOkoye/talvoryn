// D1-backed owner-only whale discovery: no fixed candidate cap, atomic page commits.
// The discovery store is independent of public whale metrics and the exchange registry.
import {read} from './storage.mjs';

const CREATE_STATE="CREATE TABLE IF NOT EXISTS whale_discovery_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)";
const CREATE_CANDIDATES="CREATE TABLE IF NOT EXISTS whale_discovery_candidates (account TEXT PRIMARY KEY, payload TEXT NOT NULL)";
const valid=a=>typeof a==='string'&&/^[a-z0-9._-]{2,64}$/.test(a);
const encode=x=>JSON.stringify(x);
const iso=t=>new Date(t).toISOString();
const empty=(account)=>({account,classification:'unverified',wallets:[],receipts:[],transferCount:0,firstSeen:null,lastSeen:null,assets:[]});

export function candidateDelta(previous,transfers,wallet,known,roster,from,to){
 const candidates=Object.fromEntries(Object.entries(previous||{}).map(([a,c])=>[a,structuredClone(c)]));
 for(const r of transfers){
  const account=r?.other_account_id;
  if(!valid(account)||known.has(account)||roster.has(account)||account==='system'||account==='wrap.near'||!r?.receipt_id||!r?.transaction_id)continue;
  const c=candidates[account]||empty(account);
  c.transferCount++;
  if(!c.wallets.includes(wallet))c.wallets.push(wallet);
  const asset=String(r.asset_id||r.asset_type||'unknown').slice(0,80);
  if(!c.assets.includes(asset)&&c.assets.length<8)c.assets.push(asset);
  if(c.receipts.length<3&&!c.receipts.some(x=>x.receipt===r.receipt_id)){
   c.receipts.push({receipt:String(r.receipt_id),transaction:String(r.transaction_id),wallet,amount:String(r.amount||'0').slice(0,80),asset});
  }
  if(/^\d+$/.test(String(r.block_timestamp||''))){
   const t=Number(BigInt(r.block_timestamp)/1000000n);
   if(Number.isFinite(t)&&t>=from&&t<to){const seen=iso(t);
    if(!c.firstSeen||seen<c.firstSeen)c.firstSeen=seen;
    if(!c.lastSeen||seen>c.lastSeen)c.lastSeen=seen;
   }
  }
  candidates[account]=c;
 }
 return candidates;
}

export async function openWhaleDiscoveryStore(db){
 // DDL only on owner request; no external requests or change to the public datasets.
 await db.batch([db.prepare(CREATE_STATE),db.prepare(CREATE_CANDIDATES)]);
 const saved=await db.prepare('SELECT payload FROM whale_discovery_state WHERE id=1').first();
 if(saved)return JSON.parse(saved.payload);
 const legacy=await read(db,'whale-discovery-backfill');
 if(!legacy)return null;
 if(legacy.revision!==1)throw Error('Unexpected legacy backfill revision');
 const {candidates={},...checkpoint}=legacy;
 checkpoint.revision=2;
 checkpoint.storage='D1_rows';
 checkpoint.candidateLimitReached=false;
 // D1 migrates all existing 437 (or more) candidate records in a single SQL statement.
 // The state pointer and candidates commit atomically; safe to re-run after interruption.
 const payload=encode(candidates);
 await db.batch([
  db.prepare("INSERT INTO whale_discovery_candidates(account,payload) SELECT key,json_object('account',key,'classification','unverified','wallets',json(COALESCE(json_extract(value,'$.accounts'),'[]')),'receipts',json('[]'),'legacySampleReceipts',json(COALESCE(json_extract(value,'$.sampleReceipts'),'[]')),'transferCount',0,'firstSeen',json_extract(value,'$.firstObservedAt'),'lastSeen',json_extract(value,'$.lastObservedAt'),'assets',json(COALESCE(json_extract(value,'$.assets'),'[]'))) FROM json_each(?) WHERE true ON CONFLICT(account) DO NOTHING").bind(payload),
  db.prepare('INSERT INTO whale_discovery_state(id,payload) VALUES(1,?) ON CONFLICT(id) DO NOTHING').bind(encode(checkpoint))
 ]);
 return checkpoint;
}

export async function saveWhaleDiscoveryInitial(db,state){
 await db.prepare('INSERT INTO whale_discovery_state(id,payload) VALUES(1,?) ON CONFLICT(id) DO NOTHING').bind(encode(state)).run();
}

export async function commitWhaleDiscoveryPage(db,state,transfers,wallet,knownAccounts){
 const known=new Set(knownAccounts),roster=new Set(state.roster);
 const unknown=[...new Set(transfers.map(r=>r?.other_account_id).filter(a=>valid(a)&&!known.has(a)&&!roster.has(a)))];
 // Single read retrieves existing records for every candidate on the page.
 const found=unknown.length?await db.prepare('SELECT account,payload FROM whale_discovery_candidates WHERE account IN (SELECT value FROM json_each(?))').bind(encode(unknown)).all():{results:[]};
 const previous=Object.fromEntries((found.results||[]).map(r=>[r.account,JSON.parse(r.payload)]));
 const merged=candidateDelta(previous,transfers,wallet,known,roster,state.from,state.to);
 const updates=Object.entries(merged).map(([account,payload])=>({account,payload:encode(payload)}));
 // One UPSERT + one checkpoint write in a D1 transaction. No page can be marked scanned
 // unless the complete batch of counterparties was stored successfully.
 const queries=[];
 if(updates.length)queries.push(db.prepare("INSERT INTO whale_discovery_candidates(account,payload) SELECT json_extract(value,'$.account'),json_extract(value,'$.payload') FROM json_each(?) WHERE true ON CONFLICT(account) DO UPDATE SET payload=excluded.payload").bind(encode(updates)));
 queries.push(db.prepare('INSERT INTO whale_discovery_state(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(encode(state)));
 await db.batch(queries);
}

export async function whaleDiscoveryCandidateSummary(db,state){
 if(!state)return {initialized:false,candidateCount:0};
 const count=await db.prepare('SELECT COUNT(*) AS n FROM whale_discovery_candidates').first();
 return {candidateCount:Number(count?.n||0),candidateLimitReached:false};
}
export async function listWhaleDiscoveryCandidates(db,limit=100){
 const data=await db.prepare("SELECT payload FROM whale_discovery_candidates ORDER BY json_array_length(json_extract(payload,'$.wallets')) DESC, CAST(json_extract(payload,'$.transferCount') AS INTEGER) DESC, account LIMIT ?").bind(Math.max(1,Math.min(100,limit))).all();
 return (data.results||[]).map(r=>JSON.parse(r.payload));
}
