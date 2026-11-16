import assert from 'node:assert/strict';
import {collectCounterpartyCandidates} from '../worker/counterparty-discovery.mjs';
import {collectWhaleHistory} from '../worker/whales.mjs';
import {EXCHANGE_REGISTRY} from '../worker/exchange-flows.mjs';
const now=Date.now(),stamp=new Date(now).toISOString();
const transfer=(account,receipt)=>({account_id:'alice.near',other_account_id:account,transaction_id:'tx'+receipt,receipt_id:'receipt'+receipt,asset_type:'Near',transfer_type:'NativeTransfer',block_timestamp:String(BigInt(now-1000)*1000000n),block_height:'234000000',amount:'1000000000000000000000000',transfer_index:0});
const cohort=new Set(['alice.near']);
const candidates=collectCounterpartyCandidates([], [transfer('unknown.near',1),transfer('unknown.near',2),transfer('alice.near',3)],'alice.near',()=>false,cohort,now);
assert.equal(candidates.length,1);assert.equal(candidates[0].classification,'unverified');
assert.deepEqual(candidates[0].accounts,['alice.near']);
const prior={revision:5,registry:EXCHANGE_REGISTRY,roster:[{account:'alice.near',verifiedDate:stamp.slice(0,10)}],wallets:[],ledger:[],pendingHistory:{}};
const fetchOld=globalThis.fetch;let external=0;
try{
 globalThis.fetch=async url=>{
  external++;
  if(String(url).includes('free.rpc.fastnear.com'))return Response.json({result:{header:{height:'234000001',timestamp_nanosec:String(BigInt(now+1000)*1000000n)}}});
  if(String(url).includes('transfers.main.fastnear.com'))return Response.json({transfers:[transfer('unknown.near',1)],resume_token:null});
  throw Error('Unexpected external request');
 };
 const result=await collectWhaleHistory(prior);
 assert.equal(external,2,'Discovery must not add provider requests');
 assert.equal(result.counterpartyCandidates.length,1);
 assert.equal(result.counterpartyCandidates[0].account,'unknown.near');
 assert.equal(result.ledger.length,0,'Unverified unknown must not enter published flow');
 assert.equal(result.periods.M.net,0);
 assert.equal(Object.keys(result.pendingHistory).length,0);
 console.log('PASS unknown counterparty is retained for review without extra API calls or false exchange flow');
}finally{globalThis.fetch=fetchOld}
