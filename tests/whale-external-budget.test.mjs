import assert from 'node:assert/strict';
import {collectWhaleHistory} from '../worker/whales.mjs';
import {EXCHANGE_REGISTRY} from '../worker/exchange-flows.mjs';

const now=Date.now(),stamp=new Date(now-3600000).toISOString();
const accounts=Array.from({length:24},(_,i)=>'whale'+i+'.near');
const prior={revision:5,registry:EXCHANGE_REGISTRY,roster:accounts.map(account=>({account,verifiedDate:stamp.slice(0,10)})),
 wallets:accounts.map(account=>({account,historyFrom:new Date(now-31*86400000).toISOString(),observedThrough:stamp})),ledger:[],pendingHistory:{}};
let outbound=0,primary=0,backup=0;
const old=globalThis.fetch;
try{
 globalThis.fetch=async url=>{
  outbound++;
  if(String(url).includes('free.rpc.fastnear.com'))return Response.json({result:{header:{height:230000000,timestamp_nanosec:String(BigInt(now+1000)*1000000n)}}});
  if(String(url).includes('transfers.main.fastnear.com')){primary++;return Response.json({transfers:[],resume_token:null});}
  if(String(url).includes('nearblocks.io')){backup++;throw Error('Should not reach backup when request budget is exhausted');}
  throw Error('unexpected URL');
 };
 const result=await collectWhaleHistory(structuredClone(prior),null,{batchIndex:0,batchCount:1,externalLimit:13});
 assert.equal(result.externalRequests,13,'Total external calls cannot exceed cap');
 assert.equal(outbound,13);
 assert.equal(backup,0,'Do not switch to backup when Cloudflare request budget is exhausted');
 assert.equal(result.wallets.length,24,'Previous wallet readings preserved');
 assert(Object.values(result.pendingHistory).some(x=>x.reason==='worker_subrequest_budget'));
 assert(result.periods.D.complete===false);
 console.log('PASS shared budget bounds RPC + FastNEAR + retries + backup; safe pending checkpoints');
}finally{globalThis.fetch=old}
