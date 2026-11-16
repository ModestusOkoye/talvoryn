import assert from 'node:assert/strict';
import {candidateDelta} from '../worker/whale-discovery-store.mjs';
import {advanceWhaleDiscoveryStored} from '../worker/whale-discovery-backfill.mjs';
const now=Date.parse('2026-11-16T18:58:12Z');
const accounts=Array.from({length:48},(_,i)=>'whale'+i+'.near');
const checkpoint={revision:2,storage:'D1_rows',from:now-30*86400000,to:now,roster:accounts,
 nextWallet:12,cursor:null,scannedPages:20,scannedTransfers:1357,completedWallets:12,
 knownTransferCount:1,completed:false,createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
const tx=(account,i)=>({account_id:accounts[12],other_account_id:account,receipt_id:'receipt'+i,transaction_id:'tx'+i,
 block_timestamp:String(BigInt(now-1000)*1000000n),asset_type:'Near',amount:'1000000000000000000000000'});
const transfers=Array.from({length:850},(_,i)=>tx('unknown'+i+'.near',i));
let candidates=candidateDelta({},transfers,accounts[12],new Set(),new Set(accounts),checkpoint.from,checkpoint.to);
assert.equal(Object.keys(candidates).length,850,'Do not discard candidates after 600');
assert(Object.values(candidates).every(c=>c.classification==='unverified'));
const first=candidateDelta({},[tx('unknown0.near',0)],accounts[12],new Set(),new Set(accounts),checkpoint.from,checkpoint.to);
assert.equal(first['unknown0.near'].transferCount,1);
const second=candidateDelta(first,[tx('unknown0.near',1)],accounts[12],new Set(),new Set(accounts),checkpoint.from,checkpoint.to);
assert.equal(second['unknown0.near'].transferCount,2);
assert.equal(second['unknown0.near'].wallets.length,1);

let calls=0,commits=0,commitFailure=false,saved=structuredClone(checkpoint);
const fetchPage=async body=>{
 calls++;
 assert.equal(body.account_id,accounts[saved.nextWallet],'Resume exact uncompleted wallet');
 return {transfers:[tx('unknown850.near',calls)],resume_token:null};
};
const commitPage=async (newState,rows,wallet)=>{
 commits++;
 if(commitFailure)throw Error('D1 write failed');
 assert.equal(wallet,accounts[12]);
 saved=structuredClone(newState);
};
commitFailure=true;
let res=await advanceWhaleDiscoveryStored(checkpoint,{fetchPage,commitPage,knownAccounts:[],pageLimit:1,now});
assert.equal(res.completedWallets,12,'Storage error must not advance checkpoint');
assert.equal(saved.completedWallets,12);
assert.equal(res.lastError,'page_or_storage_error');
commitFailure=false;
res=await advanceWhaleDiscoveryStored(saved,{fetchPage,commitPage,knownAccounts:[],pageLimit:1,now});
assert.equal(saved.completedWallets,13);
assert.equal(saved.scannedPages,21);
assert.equal(res.requestsThisRun,1);
assert.equal(calls,2,'Failed page must be retried without restarting backfill');
console.log('PASS: >600 candidates retained, exact D1 per-page checkpoint recovery, no public-flow classification');
