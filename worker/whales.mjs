import {EXCHANGE_REGISTRY,knownExchangeAccount,dexAccount,transferId,exchangeTransfer,proveDexTransfer} from './exchange-flows.mjs';
import {fetchNearBlocksWindow} from './nearblocks-fallback.mjs';
import {collectCounterpartyCandidates} from './counterparty-discovery.mjs';
const nonWallet=/(?:^|[.\-_])(binance|coinbase|kraken|okx|kucoin|bybit|huobi|mexc|gate|treasury|foundation|intents|bridge|burrow|ref-finance|ref-labs|sputnik-dao|poolv1|pool|staking|validator|fees|farm|dao|dex|vault|relay)(?:[.\-_]|$)|^(?:wrap\.near|aurora|near|system|buybacks\.multisignature\.near)$/i;
export const excludedWhale=a=>!a||knownExchangeAccount(a)||nonWallet.test(a)||/^(binance|coinbase|kraken|okx|kucoin|bybit|huobi|mexc|gateio|nfendowment|foundation|contributors|treasury)/i.test(a);
const nearUnits=n=>Number(BigInt(n||0)/1000000000000000000n)/1e6;
export function whaleFlows(wallets,rows,from,to,finalHeight,proofs=new Map()){const cohort=new Set(wallets.map(w=>w.account)),totals=new Map(wallets.map(w=>[w.account,{...w,inflow:0,outflow:0}])),seen=new Set();for(const r of rows){if(!cohort.has(r.account_id)||r.asset_type!=='Near'&&!(r.asset_type==='Ft'&&['wrap.near','nep141:wrap.near'].includes(r.asset_id)))continue;const t=Number(BigInt(r.block_timestamp)/1000000n);if(t<from||t>=to||BigInt(r.block_height)>BigInt(finalHeight))continue;if(cohort.has(r.other_account_id)||!r.other_account_id||r.other_account_id==='system'||r.other_account_id==='wrap.near'||/poolv1\.near$/.test(r.other_account_id))continue;const id=r.account_id+':'+r.receipt_id+':'+r.transfer_index;if(seen.has(id))continue;seen.add(id);if(!exchangeTransfer(r,proofs))continue;const amount=nearUnits(r.amount),w=totals.get(r.account_id);if(amount>0)w.inflow+=amount;else w.outflow-=amount}const list=[...totals.values()].map(w=>({...w,net:w.inflow-w.outflow})),incoming=list.reduce((n,w)=>n+w.inflow,0),outgoing=list.reduce((n,w)=>n+w.outflow,0),total=incoming+outgoing;return {wallets:list,incoming,outgoing,net:incoming-outgoing,score:total>=1?Math.round(100*incoming/total):null,label:total<1?'No qualifying movement':incoming/total>.6?'More inflows':incoming/total<.4?'More outflows':'Neutral'}}
async function whaleJSON(url,options={},request=fetch){let error;for(let attempt=0;attempt<2;attempt++){try{const r=await request(url,{...options,headers:{Accept:'application/json',...options.headers},signal:AbortSignal.timeout(10000)});if(!r.ok){const e=Error('Source HTTP '+r.status);e.rateLimited=r.status===429;throw e;}return await r.json()}catch(e){error=e;if(e.rateLimited)break}}throw error}
const fastnearAuth=key=>key?{Authorization:'Bearer '+key}:{};
async function whaleRPC(method,params,key,request=fetch){const d=await whaleJSON(key?'https://rpc.mainnet.fastnear.com':'https://free.rpc.fastnear.com',{method:'POST',headers:{'Content-Type':'application/json',...fastnearAuth(key)},body:JSON.stringify({jsonrpc:'2.0',id:'whale',method,params})},request);if(d.error)throw Error('RPC unavailable');return d.result}
async function transfers(body,key,request=fetch){return whaleJSON('https://transfers.main.fastnear.com/v0/transfers',{method:'POST',headers:{'Content-Type':'application/json',...fastnearAuth(key)},body:JSON.stringify(body)},request)}
export async function collectWhales(previous){
 const checkedAt=new Date().toISOString(),to=Date.now(),from=Date.parse(checkedAt.slice(0,10)+'T00:00:00Z');
 try{
  const final=await whaleRPC('block',{finality:'final'});
  let roster=(previous.roster||previous.wallets||[]).filter(w=>!excludedWhale(w.account)&&w.codeHash==='11111111111111111111111111111111').slice(0,50);
  const stale=roster.filter(w=>w.verifiedDate!==checkedAt.slice(0,10)).slice(0,3);
  for(const w of stale){try{const v=await whaleRPC('query',{request_type:'view_account',finality:'final',account_id:w.account});const balance=nearUnits(v.amount);if(v.code_hash!=='11111111111111111111111111111111'||balance<100000)roster=roster.filter(x=>x.account!==w.account);else Object.assign(w,{balance,codeHash:v.code_hash,verifiedDate:checkedAt.slice(0,10),balanceBlock:v.block_height})}catch{}}
  const cohort=new Set(roster.map(w=>w.account));let rows=[],completeWallets=[],partial=0;
  const cursor=(previous.flowCursor||0)%Math.max(1,roster.length),covered=new Set((previous.wallets||[]).map(w=>w.account)),ordered=[...roster.slice(cursor),...roster.slice(0,cursor)],batchRoster=[...ordered.filter(w=>!covered.has(w.account)),...ordered.filter(w=>covered.has(w.account))].slice(0,10);let requests=0,sourceRateLimited=false;
  for(let i=0;i<batchRoster.length;i+=3){const batches=await Promise.all(batchRoster.slice(i,i+3).map(async w=>{try{let cursor;const history=[];for(let page=0;page<5;page++){if(sourceRateLimited||requests>=14)throw Error('Batch budget reached');requests++;let d;try{d=await transfers({account_id:w.account,ignore_system:true,from_timestamp_ms:from,to_timestamp_ms:to,limit:1000,desc:true,...(cursor?{resume_token:cursor}:{})});}catch(e){if(e.rateLimited)sourceRateLimited=true;throw e}history.push(...(d.transfers||[]));cursor=d.resume_token;if(!cursor)return {w,history}}return null}catch{return null}}));for(const b of batches){if(b){completeWallets.push(b.w);rows.push(...b.history.filter(r=>!cohort.has(r.other_account_id)))}else partial++}}
  const proofs=new Map(),proofCache=new Map();let proofRequests=0,unverifiedDexTransfers=0;
  for(const r of rows){if(!dexAccount(r.other_account_id))continue;const k=r.transaction_id+':'+r.signer_id;let tx=proofCache.get(k);if(!proofCache.has(k)&&proofRequests<3&&r.transaction_id&&r.signer_id){proofRequests++;try{tx=await whaleRPC('EXPERIMENTAL_tx_status',{tx_hash:r.transaction_id,sender_account_id:r.signer_id,wait_until:'FINAL'})}catch{tx=null}proofCache.set(k,tx)}const evidence=proveDexTransfer(r,tx);if(evidence)proofs.set(transferId(r),evidence);else unverifiedDexTransfers++;}
  for(const w of completeWallets)w.unverifiedDexTransfers=rows.filter(r=>r.account_id===w.account&&dexAccount(r.other_account_id)&&!proofs.has(transferId(r))).length;
  const result=whaleFlows(completeWallets,rows,from,to,final.header.height,proofs),seen=new Set(),events=[];
  for(const r of rows){if(r.asset_type!=='Near'&&!(r.asset_type==='Ft'&&['wrap.near','nep141:wrap.near'].includes(r.asset_id)))continue;if(!r.other_account_id||r.other_account_id==='system'||r.other_account_id==='wrap.near'||/poolv1\.near$/.test(r.other_account_id))continue;const timestamp=Number(BigInt(r.block_timestamp)/1000000n);if(timestamp<from||timestamp>=to||BigInt(r.block_height)>BigInt(final.header.height))continue;const evidence=exchangeTransfer(r,proofs);if(!evidence)continue;const id=transferId(r);if(seen.has(id))continue;seen.add(id);events.push({...evidence,id,account:r.account_id,counterparty:r.other_account_id,amount:nearUnits(r.amount),receipt:r.receipt_id,transaction:r.transaction_id||null,asset:r.asset_id,timestamp:new Date(timestamp).toISOString(),block:r.block_height})}
  return mergeWhaleSnapshots(previous,{...result,score:null,roster,flowCursor:(cursor+batchRoster.length)%Math.max(1,roster.length),events:events.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,1000),revision:4,startedAt:previous.startedAt||checkedAt,mode:'today_exchange_flows',classification:'verified_exchange_flows',registry:EXCHANGE_REGISTRY,unverifiedDexTransfers,checkedAt,from:new Date(from).toISOString(),through:new Date(to).toISOString(),ok:completeWallets.length>0,threshold:100000,candidatesChecked:roster.length,partialWallets:partial,coverage:'Limited sample of native-NEAR wallets; not a network-wide top-50 ranking. Known named exchanges, treasuries and contracts are excluded; unlabelled custodial accounts may remain.',method:'Inflow = withdrawals from published CEX addresses plus proven DEX NEAR buys. Outflow = deposits to published CEX addresses plus proven DEX NEAR sells. Ordinary wallet transfers, unlabelled counterparties, custodians, internal transfers and unproven DEX activity are excluded. CEX deposits and withdrawals do not prove an offchain trade. DEX legs require successful swap logs and exact transfer receipts. Coverage is limited to the listed venues and direct wallet legs; trades held inside DEX balances or routed through other accounts may be absent. UTC day from midnight; each wallet retains its observation time.'});
 }catch(e){return {...previous,ok:false,error:e.message,attemptedAt:checkedAt}}
}

export function mergeWhaleSnapshots(previous,next){
 if(!previous||previous.classification!==next.classification||previous.registry?.version!==next.registry?.version||previous.from?.slice(0,10)!==next.from?.slice(0,10))previous={wallets:[],events:[]};
 const roster=new Set((next.roster||[]).map(w=>w.account)),fresh=new Set((next.wallets||[]).map(w=>w.account)),map=new Map();
 for(const w of previous.wallets||[])if(roster.has(w.account))map.set(w.account,{...w,observedThrough:w.observedThrough||previous.through});
 for(const w of next.wallets||[])map.set(w.account,{...w,observedThrough:w.observedThrough||next.through});
 const wallets=[...map.values()],incoming=wallets.reduce((n,w)=>n+w.inflow,0),outgoing=wallets.reduce((n,w)=>n+w.outflow,0),seen=new Set(),events=[];
 for(const e of [...(next.events||[]),...(previous.events||[]).filter(e=>!fresh.has(e.account))])if(roster.has(e.account)&&!seen.has(e.id)){seen.add(e.id);events.push(e)}
 return {...next,wallets,incoming,outgoing,net:incoming-outgoing,unverifiedDexTransfers:wallets.reduce((n,w)=>n+(w.unverifiedDexTransfers||0),0),events:events.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,1000),partialWallets:Math.max(0,roster.size-wallets.length),cachedWallets:wallets.filter(w=>w.observedThrough!==next.through).length,liveCheckedWallets:fresh.size,ok:wallets.length>0};
}

const WHALE_DAY=86400000;
export function whalePeriods(state,now=Date.now()){
 const roster=(state.roster||[]).filter(w=>!excludedWhale(w.account)),cohort=new Set(roster.map(w=>w.account)),observations=(state.wallets||[]).filter(w=>cohort.has(w.account)).map(w=>Date.parse(w.observedThrough)).filter(Number.isFinite),end=observations.length?Math.min(now,...observations):now,through=new Date(end).toISOString(),dedup=new Map();
 for(const e of state.ledger||[]){const t=Date.parse(e.timestamp);if(!cohort.has(e.account)||cohort.has(e.counterparty)||t<end-30*WHALE_DAY||t>=now||!e.transaction||!['CEX deposit','CEX withdrawal','DEX buy','DEX sell'].includes(e.kind))continue;dedup.set(e.id,e)}
 const ledger=[...dedup.values()].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)),periods={};
 for(const [period,days] of [['D',1],['W',7],['M',30]]){
  const from=end-days*WHALE_DAY,covered=(state.wallets||[]).filter(w=>cohort.has(w.account)&&Date.parse(w.historyFrom)<=from&&Date.parse(w.observedThrough)>=end),coveredAccounts=new Set(covered.map(w=>w.account));
  const events=ledger.filter(e=>Date.parse(e.timestamp)>=from&&Date.parse(e.timestamp)<end&&coveredAccounts.has(e.account)),incoming=events.reduce((n,e)=>n+Math.max(0,e.amount),0),outgoing=events.reduce((n,e)=>n+Math.max(0,-e.amount),0),unverifiedDexTransfers=covered.reduce((n,w)=>n+(w.unverifiedDexTransfers||0),0);
  periods[period]={period,days,from:new Date(from).toISOString(),through,incoming,outgoing,net:incoming-outgoing,events,wallets:covered,roster,partialWallets:roster.length-covered.length,cachedWallets:covered.filter(w=>Date.parse(w.observedThrough)<now).length,unverifiedDexTransfers,ok:covered.length>0,complete:covered.length===roster.length&&roster.length>0&&!unverifiedDexTransfers&&!covered.some(w=>w.nativeOnly)&&!Object.keys(state.pendingHistory||{}).some(account=>cohort.has(account))};
 }
 return {...state,revision:5,mode:'rolling_exchange_flows',classification:'verified_exchange_flows',ledger,periods,registry:EXCHANGE_REGISTRY,...periods.D,periods};
}
export function mergeWhaleHistory(previous,next){
 const same=previous?.revision===5&&previous.registry?.version===EXCHANGE_REGISTRY.version,old=same?previous:{wallets:[],ledger:[]},roster=next.roster||old.roster||[],cohort=new Set(roster.map(w=>w.account)),fresh=new Map((next.wallets||[]).map(w=>[w.account,w]));
 const wallets=new Map((old.wallets||[]).filter(w=>cohort.has(w.account)).map(w=>[w.account,w]));for(const w of next.wallets||[])wallets.set(w.account,w);
 const ledger=(old.ledger||[]).filter(e=>{const w=fresh.get(e.account);return cohort.has(e.account)&&(!w||Date.parse(e.timestamp)<Date.parse(w.refreshedFrom)||(w.nativeOnly&&e.venueType==='DEX'))});ledger.push(...(next.ledger||[]));
 return whalePeriods({...old,...next,roster,wallets:[...wallets.values()],ledger},Date.parse(next.through));
}
export async function collectWhaleHistory(previous,fastnearKey=null,{batchIndex=0,batchCount=1,externalLimit=46}={}){
 const now=Date.now(),through=new Date(now).toISOString(),start=now-30*WHALE_DAY;
 let externalRequests=0;
 const request=(url,options)=>{if(externalRequests>=externalLimit){const e=Error('External request budget exhausted');e.code='worker_subrequest_budget';throw e;}externalRequests++;return fetch(url,options)};
 try{
  const final=await whaleRPC('block',{finality:'final'},fastnearKey,request);let roster=(previous.roster||[]).filter(w=>!excludedWhale(w.account));
  for(const w of roster.filter(w=>w.verifiedDate!==through.slice(0,10)).slice(0,3)){try{const v=await whaleRPC('query',{request_type:'view_account',finality:'final',account_id:w.account},fastnearKey,request),balance=nearUnits(v.amount);if(v.code_hash!=='11111111111111111111111111111111'||balance<100000)roster=roster.filter(x=>x.account!==w.account);else Object.assign(w,{balance,codeHash:v.code_hash,verifiedDate:through.slice(0,10),balanceBlock:v.block_height})}catch{}}
  const old=new Map((previous.wallets||[]).map(w=>[w.account,w])),pendingHistory=structuredClone(previous.pendingHistory||{});
  // Check every wallet on each run. Older checkpoints first, then pending pages.
  // Narrow each query to the wallet's last verified observation; do not rescan 30 days.
  if(!Number.isInteger(batchIndex)||!Number.isInteger(batchCount)||batchCount<1||batchIndex<0||batchIndex>=batchCount)throw Error('Invalid whale batch');
  // Stable cohort assignment: each three-hour cycle consists of two Worker invocations.
  const ordered=[...roster].filter((_,index)=>index%batchCount===batchIndex).sort((a,b)=>(Date.parse(old.get(a.account)?.observedThrough||0)||0)-(Date.parse(old.get(b.account)?.observedThrough||0)||0));
  const fresh=[],ledger=[],cohort=new Set(roster.map(w=>w.account));let counterpartyCandidates=previous.counterpartyCandidates||[];let requests=0,limited=false,proofRequests=0,backupPages=0,backupWallets=0;const MAX_TRANSFER_REQUESTS=30;const txCache=new Map();
  for(const [walletIndex,w] of ordered.entries()){
   const remainingWallets=ordered.length-walletIndex-1;
   const prior=old.get(w.account),pending=pendingHistory[w.account];
   const from=pending?.from??(prior&&Date.parse(prior.historyFrom)<=start?Math.max(start,Date.parse(prior.observedThrough)-60000):start);
   const finalTime=Number(BigInt(final.header.timestamp_nanosec)/1000000n);
   const to=Math.min(pending?.to??now,finalTime);
   // A saved NearBlocks page is backup evidence, not a permanent provider assignment.
   // Retain it for fallback, but restart FastNEAR from this window's beginning.
   const backupCheckpoint=pending?.provider==='nearblocks'?pending:null;
   let cursor=backupCheckpoint?null:pending?.cursor;
   let rows=backupCheckpoint?[]:pending?.rows||[];
   let complete=!!pending?.downloadComplete&&!backupCheckpoint,nativeOnly=false,fastnearFailed=false,fastnearError=null;
   // FastNEAR gets first priority on every run, including previous backup wallets.
   if(!complete&&!limited&&requests<MAX_TRANSFER_REQUESTS){
    try{
     for(let page=0;page<3;page++){
      // Reserve one FastNEAR request for each wallet we have not visited yet.
      // Spend spare budget on additional pages of this wallet's missing history.
      if(requests>=MAX_TRANSFER_REQUESTS||page>0&&requests+remainingWallets>=MAX_TRANSFER_REQUESTS)break;
      requests++;
      const d=await transfers({account_id:w.account,ignore_system:true,from_timestamp_ms:from,to_timestamp_ms:to,limit:100,desc:true,...(cursor?{resume_token:cursor}:{})},fastnearKey,request);
      if(!Array.isArray(d.transfers)){const err=Error('Invalid FastNEAR transfer page');err.code='invalid_transfer_response';throw err;}
      // Discover unknown counterparties independently; only verified exchange transfers enter the published ledger.
      counterpartyCandidates=collectCounterpartyCandidates(counterpartyCandidates,d.transfers,w.account,knownExchangeAccount,cohort,now);
      rows.push(...d.transfers.filter(r=>knownExchangeAccount(r.other_account_id)));
      cursor=d.resume_token;
      if(!cursor){complete=true;break}
     }
    }catch(e){fastnearFailed=true;fastnearError=e.rateLimited?'rate_limit':e.code||(/Source HTTP \d+/.exec(e.message||'')||[])[0]||(['TimeoutError','AbortError'].includes(e.name)?'timeout':e.name==='TypeError'?'network_error':'unknown_error');if(e.rateLimited)limited=true;}
   }
   // When FastNEAR cannot finish, use bounded NearBlocks v3 native receipts.
   // NearBlocks is native-only here: DEX/wNEAR coverage is NOT claimed complete.
   if(!complete&&(fastnearFailed||limited)&&fastnearError!=='worker_subrequest_budget'&&externalRequests<externalLimit&&backupPages<6){
    try{
     const saved=backupCheckpoint||{};
     const result=await fetchNearBlocksWindow(w.account,from,to,saved,Math.min(3,6-backupPages),request);
     backupPages+=result.pages;
     if(result.complete){
      rows=result.rows;complete=true;nativeOnly=true;backupWallets++;
     }else{
      pendingHistory[w.account]={from,to,provider:'nearblocks',rows:result.rows,next:result.next,reason:'more_pages'};
      continue;
     }
    }catch(e){
     pendingHistory[w.account]=e.checkpoint?.next?{from,to,provider:'nearblocks',...e.checkpoint,reason:e.rateLimited?'backup_rate_limit':'backup_error'}:backupCheckpoint?{...backupCheckpoint,reason:e.rateLimited?'backup_rate_limit':'backup_error'}:{from,to,provider:'fastnear',cursor:cursor||null,rows,reason:fastnearError||'backup_error',backupReason:e.rateLimited?'rate_limit':/^NearBlocks HTTP \d+$/.test(e.message||'')?e.message:'backup_request_error'};
     continue;
    }
   }
   if(!complete){
    pendingHistory[w.account]={from,to,provider:nativeOnly?'nearblocks':'fastnear',cursor:cursor||null,rows,reason:fastnearError||(externalRequests>=externalLimit?'worker_subrequest_budget':requests>=MAX_TRANSFER_REQUESTS?'budget_exhausted':'more_pages')};
    continue;
   }
   delete pendingHistory[w.account];
   const proofs=new Map(pending?.proofDecisions||[]);let unverifiedDexTransfers=0;
   for(const r of rows){if(!dexAccount(r.other_account_id)||r.asset_type!=='Ft'||r.transfer_type!=='FtTransfer'||!['wrap.near','nep141:wrap.near'].includes(r.asset_id)||proofs.has(transferId(r)))continue;const k=r.transaction_id+':'+r.signer_id;let tx=txCache.get(k);if(!txCache.has(k)&&proofRequests<3&&r.transaction_id&&r.signer_id){proofRequests++;try{tx=await whaleRPC('EXPERIMENTAL_tx_status',{tx_hash:r.transaction_id,sender_account_id:r.signer_id,wait_until:'FINAL'},fastnearKey,request)}catch{tx=null}txCache.set(k,tx)}if(tx)proofs.set(transferId(r),proveDexTransfer(r,tx));else unverifiedDexTransfers++;}
   if(unverifiedDexTransfers){pendingHistory[w.account]={from,to,rows,downloadComplete:true,proofDecisions:[...proofs]};continue;}
   const seen=new Set();for(const r of rows){if(cohort.has(r.other_account_id))continue;const t=Number(BigInt(r.block_timestamp)/1000000n);if(t<from||t>=to||BigInt(r.block_height)>BigInt(final.header.height))continue;const evidence=exchangeTransfer(r,proofs),id=transferId(r);if(!evidence||seen.has(id))continue;seen.add(id);ledger.push({...evidence,id,account:r.account_id,counterparty:r.other_account_id,amount:nearUnits(r.amount),receipt:r.receipt_id,transaction:r.transaction_id,asset:r.asset_id,timestamp:new Date(t).toISOString(),block:r.block_height})}
   fresh.push({...w,nativeOnly,historyFrom:prior&&Date.parse(prior.historyFrom)<=start?prior.historyFrom:new Date(start).toISOString(),refreshedFrom:new Date(from).toISOString(),observedThrough:new Date(to).toISOString(),unverifiedDexTransfers:0});
  }
  return mergeWhaleHistory(previous,{roster,wallets:fresh,ledger,counterpartyCandidates,through,flowCursor:0,pendingHistory,checkedAt:through,sourceRateLimited:limited,backupWallets,transferRequests:requests,externalRequests,batchIndex,batchCount,threshold:100000,method:'Rolling 24 hours, 7 days and 30 days for the same present-day whale sample. Published CEX movements and receipt-proven DEX swaps only. No ordinary wallet transfers. Historical events do not imply the account met the whale threshold at the event time. Saved wallet histories retain their actual observation times.'});
 }catch(e){return {...whalePeriods(previous,now),ok:false,error:e.message,attemptedAt:through}}
}

/** Single-request, owner-only schema probe; no changes to D1 and no secret data in output. */
export async function diagnoseWhaleTransfer(previous,fastnearKey){
 if(!fastnearKey)return {ok:false,reason:'FastNEAR key not configured'};
 const entries=Object.entries(previous?.pendingHistory||{});
 const item=entries.find(([account,p])=>previous.roster?.some(w=>w.account===account)&&p.provider==='fastnear'&&['Error','invalid_transfer_response'].includes(p.reason))
   ||entries.find(([account,p])=>previous.roster?.some(w=>w.account===account)&&p.provider==='fastnear');
 if(!item)return {ok:false,reason:'No eligible pending FastNEAR wallet'};
 const [account,p]=item;
 const body={account_id:account,ignore_system:true,from_timestamp_ms:p.from,to_timestamp_ms:p.to,limit:100,desc:true,...(p.cursor?{resume_token:p.cursor}:{})};
 try{
  const response=await fetch('https://transfers.main.fastnear.com/v0/transfers',{
   method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',...fastnearAuth(fastnearKey)},
   body:JSON.stringify(body),signal:AbortSignal.timeout(10000)
  });
  const contentType=response.headers.get('content-type')||'';
  const data=contentType.includes('json')?await response.json().catch(()=>null):null;
  const keys=data&&typeof data==='object'&&!Array.isArray(data)?Object.keys(data).slice(0,12):[];
  const error=data?.error;
  return {ok:response.ok&&Array.isArray(data?.transfers),httpStatus:response.status,
   contentType:contentType.slice(0,64),responseKeys:keys,transfersArray:Array.isArray(data?.transfers),
   transfersCount:Array.isArray(data?.transfers)?data.transfers.length:null,
   hasResumeToken:!!data?.resume_token,
   errorType:error==null?null:Array.isArray(error)?'array':typeof error,
   errorKeys:error&&typeof error==='object'?Object.keys(error).slice(0,8):[],
   errorCode:typeof error?.code==='number'?error.code:null,
   // Names and durations only; no account IDs, response bodies, tokens, or private data.
   pendingReason:p.reason||'unknown'};
 }catch(e){return {ok:false,networkError:['TimeoutError','AbortError'].includes(e.name)?'timeout':e.name==='TypeError'?'network_error':'unexpected_error'};}
}
