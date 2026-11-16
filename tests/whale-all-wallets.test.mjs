import assert from 'node:assert/strict';
import {collectWhaleHistory} from '../worker/whales.mjs';
import {EXCHANGE_REGISTRY} from '../worker/exchange-flows.mjs';
const now=Date.now(),accounts=Array.from({length:48},(_,i)=>'whale'+i+'.near');
const stamp=new Date(now-4*3600000).toISOString();
const previous={
 revision:5,registry:EXCHANGE_REGISTRY,
 roster:accounts.map(account=>({account,verifiedDate:new Date(now).toISOString().slice(0,10),codeHash:'11111111111111111111111111111111'})),
 wallets:accounts.map(account=>({account,historyFrom:new Date(now-31*86400000).toISOString(),observedThrough:stamp})),
 ledger:[],pendingHistory:{}
};
let requests=0;const visited=new Set(),perWallet=new Map(),original=globalThis.fetch;
try {
 globalThis.fetch=async (url,options={})=>{
  if(String(url).includes('free.rpc.fastnear.com'))return Response.json({result:{header:{height:'234000000',timestamp_nanosec:String(BigInt(now+1000)*1000000n)}}});
  if(String(url).includes('transfers.main.fastnear.com')){
   const body=JSON.parse(options.body);requests++;visited.add(body.account_id);perWallet.set(body.account_id,(perWallet.get(body.account_id)||0)+1);
   assert(body.from_timestamp_ms>=Date.parse(stamp)-60000,'No repeated 30-day scan');
   assert(body.limit===100,'Bounded page size');
   const index=Number(body.account_id.match(/^whale(\d+)\.near$/)[1]);
   return Response.json({transfers:[],resume_token:index<6&&perWallet.get(body.account_id)===1?'page-two':null});
  }
  throw Error('Unexpected request '+url);
 };
 const first=await collectWhaleHistory(structuredClone(previous),null,{batchIndex:0,batchCount:2,externalLimit:46});
 assert.equal(first.batchIndex,0);
 assert.equal(first.wallets.length,48,'Saved sample retained after batch 1');
 assert(first.externalRequests<=46);
 const second=await collectWhaleHistory(first,null,{batchIndex:1,batchCount:2,externalLimit:46});
 assert.equal(second.batchIndex,1);
 assert(second.externalRequests<=46);
 assert.equal(visited.size,48,'Both batches cover all 48 wallets');
 assert.equal(requests,54,'48 initial pages plus 6 needed continuation pages');
 assert([...perWallet.entries()].every(([account,calls])=>calls===(Number(account.match(/^whale(\d+)\.near$/)[1])<6?2:1)),'No unnecessary pages fetched');
 assert.equal(second.wallets.length,48);
 assert.equal(Object.keys(second.pendingHistory).length,0);
 console.log('PASS: two bounded Worker invocations cover 48 wallets and 6 additional pages');

} finally {globalThis.fetch=original}
