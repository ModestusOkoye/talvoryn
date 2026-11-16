import assert from 'node:assert/strict';
import {beginWhaleDiscovery,advanceWhaleDiscovery,whaleDiscoverySummary,rankedWhaleCandidates} from '../worker/whale-discovery-backfill.mjs';
const now=Date.parse('2026-11-16T20:00:00Z');
const roster=Array.from({length:48},(_,i)=>({account:'w'+i+'.near'}));
const a=beginWhaleDiscovery(roster,{version:'exchange-v1'},now);
assert.equal(a.roster.length,48);
assert.equal(a.from,now-30*86400000);
assert.throws(()=>beginWhaleDiscovery(roster.slice(0,47),{}),/48/);
let calls=0;const callsByWallet=new Map();
const row=(counterparty,i)=>({account_id:'w'+i+'.near',other_account_id:counterparty,transaction_id:'tx'+i,receipt_id:'r'+i,amount:'1000000000000000000000000',asset_type:'Near',block_timestamp:String(BigInt(now-1000)*1000000n)});
const fetchPage=async body=>{
 calls++;
 assert.equal(body.to_timestamp_ms,now,'Fixed history window');
 assert.equal(body.from_timestamp_ms,now-30*86400000);
 const i=Number(body.account_id.match(/^w(\d+)/)[1]);
 const n=(callsByWallet.get(i)||0)+1;callsByWallet.set(i,n);
 if(i===0&&n===1)return {transfers:[row('unverified.near',i)],resume_token:'page2'};
 assert.equal(body.resume_token,i===0?'page2':undefined);
 return {transfers:[row('unverified.near',i),row('binance1.near',i)],resume_token:null};
};
let state=structuredClone(a);const knownAccounts=['binance1.near'];
for(let n=0;n<3;n++){
 state=await advanceWhaleDiscovery(state,{fetchPage,knownAccounts,now,pageLimit:20});
 assert(state.requestsThisRun<=20);
 if(n<2)assert.equal(state.completed,false);
}
assert.equal(calls,49,'48 wallets plus one extra page');
assert.equal(state.completed,true);
assert.equal(state.completedWallets,48);
assert.equal(state.scannedPages,49);
assert.equal(state.knownTransferCount,48);
assert.equal(state.candidates['unverified.near'].classification,'unverified');
assert.equal(state.candidates['unverified.near'].wallets.length,48);
assert.equal(rankedWhaleCandidates(state)[0].account,'unverified.near');
assert.equal(whaleDiscoverySummary(state).candidateCount,1);
const noMore=await advanceWhaleDiscovery(state,{fetchPage,knownAccounts});
assert.equal(calls,49,'Completed scan must never call the provider again');

let checkpoint=beginWhaleDiscovery(roster,{version:'v1'},now),fails=0;
const flaky=async body=>{if(!fails++){throw Error('Source HTTP 503')}return {transfers:[],resume_token:null}};
checkpoint=await advanceWhaleDiscovery(checkpoint,{fetchPage:flaky,knownAccounts,pageLimit:20,now});
assert.equal(checkpoint.completedWallets,0);
assert.equal(checkpoint.nextWallet,0);
assert.equal(checkpoint.lastError,'Source HTTP 503');
checkpoint=await advanceWhaleDiscovery(checkpoint,{fetchPage:flaky,knownAccounts,pageLimit:1,now});
assert.equal(checkpoint.completedWallets,1,'Retry must resume same wallet');
console.log('PASS: 30-day fixed-window backfill, 20-call budget, paging, staging, safe retries and no automatic classification');
