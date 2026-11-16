import assert from 'node:assert/strict';
import {collectWhaleHistory} from '../worker/whales.mjs';
import {EXCHANGE_REGISTRY} from '../worker/exchange-flows.mjs';
const now=Date.now(),when=new Date(now).toISOString();
const old={revision:5,registry:EXCHANGE_REGISTRY,roster:[{account:'alice.near',verifiedDate:when.slice(0,10)}],wallets:[],ledger:[],pendingHistory:{}};
const orig=globalThis.fetch;
try{
 globalThis.fetch=async url=>{
  const u=String(url);
  if(u.includes('free.rpc.fastnear.com'))return Response.json({result:{header:{height:999999999,timestamp_nanosec:String(BigInt(now+1000)*1000000n)}}});
  if(u.includes('transfers.main.fastnear.com'))return Response.json({unexpected:'unexpected shape'});
  if(u.includes('api.nearblocks.io'))return new Response('Bad gateway',{status:502});
  throw Error('Unexpected provider');
 };
 const result=await collectWhaleHistory(old);
 assert.equal(result.pendingHistory['alice.near']?.reason,'invalid_transfer_response');
 assert.equal(result.pendingHistory['alice.near']?.backupReason,'NearBlocks HTTP 502');
 assert.equal(result.wallets.length,0);
 console.log('PASS invalid transfer response is recorded without falsely advancing coverage');
}finally{globalThis.fetch=orig}
