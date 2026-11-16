// Owner-only historical discovery. This NEVER alters the public whale ledger or exchange allowlist.
const DAY=86400000,MAX_PAGES=20,MAX_CANDIDATES=600;
const valid=a=>typeof a==='string'&&/^[a-z0-9._-]{2,64}$/.test(a);
const iso=t=>new Date(t).toISOString();
const ms=t=>Number(t);
function addCandidate(state,row,wallet){
 const account=row?.other_account_id;
 if(!valid(account)||state.roster.includes(account)||state.known.has(account)||account==='system'||account==='wrap.near')return;
 if(!row?.receipt_id||!row?.transaction_id)return;
 let candidate=state.candidates[account];
 if(!candidate){
  if(Object.keys(state.candidates).length>=MAX_CANDIDATES){state.candidateLimitReached=true;return}
  candidate={account,classification:'unverified',wallets:[],receipts:[],transferCount:0,firstSeen:null,lastSeen:null,assets:[]};
  state.candidates[account]=candidate;
 }
 candidate.transferCount++;
 if(!candidate.wallets.includes(wallet))candidate.wallets.push(wallet);
 const asset=String(row.asset_id||row.asset_type||'unknown').slice(0,80);
 if(!candidate.assets.includes(asset)&&candidate.assets.length<8)candidate.assets.push(asset);
 if(candidate.receipts.length<3&&!candidate.receipts.some(x=>x.receipt===row.receipt_id)){
  candidate.receipts.push({receipt:String(row.receipt_id),transaction:String(row.transaction_id),wallet,amount:String(row.amount||'0').slice(0,80),asset});
 }
 if(/^\d+$/.test(String(row.block_timestamp||''))){
  const t=Number(BigInt(row.block_timestamp)/1000000n);
  if(Number.isFinite(t)&&t>=state.from&&t<state.to){
   const when=iso(t);
   if(!candidate.firstSeen||when<candidate.firstSeen)candidate.firstSeen=when;
   if(!candidate.lastSeen||when>candidate.lastSeen)candidate.lastSeen=when;
  }
 }
}
export function beginWhaleDiscovery(roster,registry,now=Date.now()){
 const accounts=roster.map(w=>w.account).filter(valid);
 if(accounts.length!==48||new Set(accounts).size!==48)throw Error('Expected exactly 48 distinct verified whale accounts');
 return {revision:1,from:now-30*DAY,to:now,roster:accounts,registryVersion:registry?.version||'unknown',nextWallet:0,cursor:null,
  scannedPages:0,scannedTransfers:0,completedWallets:0,knownTransferCount:0,candidates:{},candidateLimitReached:false,
  completed:false,createdAt:iso(now),updatedAt:iso(now)};
}
// One invocation processes at most 20 FastNEAR calls; no retries, no secondary provider.
// A page becomes durable only when its response is validated and its resume token saved.
export async function advanceWhaleDiscovery(previous,{fetchPage,knownAccounts,pageLimit=MAX_PAGES,now=Date.now()}){
 if(!previous||previous.revision!==1)throw Error('Invalid discovery checkpoint');
 if(previous.completed)return {...previous,updatedAt:iso(now)};
 if(!Number.isInteger(pageLimit)||pageLimit<1||pageLimit>MAX_PAGES)throw Error('Invalid page limit');
 const state=structuredClone(previous);state.known=new Set(knownAccounts);
 let requests=0;
 try{
  while(state.nextWallet<state.roster.length&&requests<pageLimit){
   const wallet=state.roster[state.nextWallet];
   const body={account_id:wallet,ignore_system:true,from_timestamp_ms:state.from,to_timestamp_ms:state.to,limit:100,desc:true,...(state.cursor?{resume_token:state.cursor}:{})};
   requests++;
   const response=await fetchPage(body);
   if(!response||!Array.isArray(response.transfers))throw Error('Invalid FastNEAR transfer response');
   for(const row of response.transfers){
    if(state.known.has(row.other_account_id))state.knownTransferCount++;
    else addCandidate(state,row,wallet);
   }
   state.scannedPages++;
   state.scannedTransfers+=response.transfers.length;
   const next=response.resume_token;
   if(next!==null&&next!==undefined&&typeof next!=='string')throw Error('Invalid FastNEAR continuation token');
   if(next){
    if(next===state.cursor)throw Error('Repeated FastNEAR continuation token');
    state.cursor=next;
   }else{
    state.nextWallet++;state.completedWallets++;state.cursor=null;
   }
  }
  state.completed=state.nextWallet===state.roster.length&&!state.candidateLimitReached;
  state.updatedAt=iso(now);
  state.lastError=null;
 }catch(e){state.lastError=e?.name==='TimeoutError'?'timeout':/Source HTTP \d+/.exec(e?.message||'')?.[0]||e?.message?.slice(0,100)||'source_error';state.updatedAt=iso(now)}
 delete state.known;
 return {...state,requestsThisRun:requests};
}
export function whaleDiscoverySummary(state){
 if(!state)return {initialized:false};
 return {initialized:true,createdAt:state.createdAt,updatedAt:state.updatedAt,
  from:state.from,to:state.to,completedWallets:state.completedWallets,totalWallets:state.roster.length,
  scannedPages:state.scannedPages,scannedTransfers:state.scannedTransfers,knownTransferCount:state.knownTransferCount,
  candidateCount:Object.keys(state.candidates||{}).length,candidateLimitReached:!!state.candidateLimitReached,
  done:!!state.completed,lastError:state.lastError||null};
}
export function rankedWhaleCandidates(state,limit=50){
 return Object.values(state?.candidates||{}).sort((a,b)=>b.wallets.length-a.wallets.length||b.transferCount-a.transferCount).slice(0,Math.min(limit,100));
}
