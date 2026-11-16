import assert from 'node:assert/strict';
import {normalizeNearBlocksReceipt,fetchNearBlocksWindow} from '../worker/nearblocks-fallback.mjs';
import {collectWhaleHistory} from '../worker/whales.mjs';
import {EXCHANGE_REGISTRY} from '../worker/exchange-flows.mjs';

const now=Date.now(),iso=t=>new Date(t).toISOString();
const receipt={
 receipt_id:'successful-receipt',transaction_hash:'confirmed-transaction',
 predecessor_account_id:'binance1.near',receiver_account_id:'alice.near',
 actions:[{action:'TRANSFER',method:null}],actions_agg:{deposit:'1000000000000000000000000'},
 outcome:{status:true},block:{block_height:'12345',block_timestamp:String(BigInt(now-120000)*1000000n)},
 block_timestamp:String(BigInt(now-120000)*1000000n)
};
const normalized=normalizeNearBlocksReceipt(receipt,'alice.near');
assert.equal(normalized.amount,'1000000000000000000000000');
assert.equal(normalized.other_account_id,'binance1.near');
assert.equal(normalizeNearBlocksReceipt({...receipt,outcome:{status:false}},'alice.near'),null);
assert.equal(normalizeNearBlocksReceipt({...receipt,actions:[{action:'FUNCTION_CALL'}]},'alice.near'),null);
assert.equal(normalizeNearBlocksReceipt({...receipt,actions:[{action:'TRANSFER'},{action:'TRANSFER'}]},'alice.near'),null);
const original=globalThis.fetch;
const priorEvent={id:'prior',account:'alice.near',counterparty:'binance1.near',kind:'CEX withdrawal',venueType:'CEX',transaction:'older-transaction',timestamp:iso(now-2*86400000),amount:25};
const previous={revision:5,registry:EXCHANGE_REGISTRY,roster:[{account:'alice.near',verifiedDate:iso(now).slice(0,10),codeHash:'11111111111111111111111111111111'}],wallets:[{account:'alice.near',historyFrom:iso(now-31*86400000),observedThrough:iso(now-600000),unverifiedDexTransfers:0}],ledger:[priorEvent],flowCursor:0,pendingHistory:{}};
try{
 globalThis.fetch=async url=>{
  const value=String(url);
  if(value.includes('free.rpc.fastnear.com'))return Response.json({jsonrpc:'2.0',result:{header:{height:12345678,timestamp_nanosec:String(BigInt(now+1000)*1000000n)}}});
  if(value.includes('transfers.main.fastnear.com'))return new Response('Rate limited',{status:429});
  if(value.includes('api.nearblocks.io'))return Response.json({data:[receipt],meta:{next_page:null}});
  throw Error('Unexpected request '+url);
 };
 const fetched=await fetchNearBlocksWindow('alice.near',now-600000,now,{},2);
 assert.equal(fetched.complete,true);
 assert.equal(fetched.rows.length,1);
 const result=await collectWhaleHistory(structuredClone(previous));
 assert.equal(result.sourceRateLimited,true);
 assert.equal(result.backupWallets,1);
 assert.equal(result.pendingHistory['alice.near'],undefined);
 assert.equal(result.wallets.length,1);
 assert.equal(result.wallets[0].nativeOnly,true);
 assert.equal(result.periods.M.complete,false,'Never claim DEX coverage from native-only receipts');
 assert(result.ledger.some(e=>e.id==='alice.near:successful-receipt:0'),'Verified native transfer was added');
 assert(result.ledger.some(e=>e.id==='prior'),'Earlier verified history was preserved');
 console.log('PASS FastNEAR 429 -> NearBlocks receipt fallback; verified events preserved; native-only coverage disclosed.');
} finally {globalThis.fetch=original}
