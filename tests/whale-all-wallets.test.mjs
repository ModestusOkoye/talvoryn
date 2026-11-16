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
   const index=Number(body.account_id.match(/^whale(\\d+)\\.near$/)[1]);
   return Response.json({transfers:[],resume_token:index<11&&perWallet.get(body.account_id)===1?'page-two':null});
  }
  throw Error('Unexpected request '+url);
 };
 const result=await collectWhaleHistory(structuredClone(previous));
 assert.equal(visited.size,48,'Every existing wallet queried');
 assert.equal(requests,59,'48 first pages plus 11 necessary continuation pages');
 assert([...perWallet.entries()].every(([account,calls])=>calls===(Number(account.match(/^whale(\\d+)\\.near$/)[1])<11?2:1)),'No unnecessary pages fetched');
 assert.equal(result.wallets.length,48);
 assert.equal(result.backupWallets,0);
 assert.equal(result.transferRequests,59);
 assert.equal(Object.keys(result.pendingHistory).length,0);
 console.log('PASS: 48 wallets checked, 11 extra pages, 59 total calls, no historical rescan');
} finally {globalThis.fetch=original}
