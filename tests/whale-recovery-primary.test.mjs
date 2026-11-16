import assert from 'node:assert/strict';
import {collectWhaleHistory} from '../worker/whales.mjs';
import {EXCHANGE_REGISTRY} from '../worker/exchange-flows.mjs';
const now=Date.now(),old=new Date(now-3600000).toISOString(),oldStart=now-2*3600000;
const previous={revision:5,registry:EXCHANGE_REGISTRY,
 roster:[{account:'alice.near',verifiedDate:new Date(now).toISOString().slice(0,10),codeHash:'11111111111111111111111111111111'}],
 wallets:[{account:'alice.near',historyFrom:new Date(now-31*86400000).toISOString(),observedThrough:old}],
 pendingHistory:{'alice.near':{provider:'nearblocks',from:oldStart,to:now-30000,rows:[],next:'saved-nearblocks-cursor'}},ledger:[]};
const original=globalThis.fetch;let fastnearCalls=0,backupCalls=0;
try{
 globalThis.fetch=async (url,options={})=>{
  const u=String(url);
  if(u.includes('free.rpc.fastnear.com'))return Response.json({result:{header:{height:'230000000',timestamp_nanosec:String(BigInt(now+1000)*1000000n)}}});
  if(u.includes('transfers.main.fastnear.com')){fastnearCalls++;const body=JSON.parse(options.body);
   assert.equal(body.account_id,'alice.near');
   assert.equal(body.from_timestamp_ms,oldStart);
   assert.equal(body.resume_token,undefined,'NearBlocks cursor must not be sent to FastNEAR');
   return Response.json({transfers:[],resume_token:null});}
  if(u.includes('api.nearblocks.io')){backupCalls++;throw Error('NearBlocks should not be called when FastNEAR works');}
  throw Error('Unexpected URL '+u);
 };
 const result=await collectWhaleHistory(structuredClone(previous));
 assert.equal(fastnearCalls,1);
 assert.equal(backupCalls,0);
 assert.equal(result.backupWallets,0);
 assert.equal(Object.keys(result.pendingHistory).length,0);
 assert.equal(result.wallets[0].nativeOnly,false);
 console.log('PASS: existing NearBlocks checkpoint does not prevent FastNEAR-first recovery');
}finally{globalThis.fetch=original}
