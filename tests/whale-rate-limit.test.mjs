import assert from 'node:assert/strict';
import {collectWhaleHistory} from '../worker/whales.mjs';
import {EXCHANGE_REGISTRY} from '../worker/exchange-flows.mjs';

// Reproduce provider pagination returning one page then HTTP 429.
// Verified prior readings and pending resume cursors must be retained.
const original=globalThis.fetch;
const now=Date.now(),iso=t=>new Date(t).toISOString();
const priorEvent={id:'prior',account:'alice.near',counterparty:'binance1.near',kind:'CEX withdrawal',transaction:'prior-transaction',timestamp:iso(now-2*86400000),amount:25};
const previous={revision:5,registry:EXCHANGE_REGISTRY,roster:[{account:'alice.near',verifiedDate:iso(now).slice(0,10),codeHash:'11111111111111111111111111111111'}],wallets:[{account:'alice.near',historyFrom:iso(now-31*86400000),observedThrough:iso(now-120000),unverifiedDexTransfers:0}],ledger:[priorEvent],flowCursor:0,pendingHistory:{'alice.near':{from:now-86400000,to:now,cursor:'saved-page-cursor',rows:[]}}};
let transferRequests=0;
try{
  globalThis.fetch=async url=>{
    if(String(url).includes('free.rpc.fastnear.com'))return Response.json({jsonrpc:'2.0',result:{header:{height:12345678,timestamp_nanosec:String(BigInt(now)*1000000n)}}});
    if(String(url).includes('transfers.main.fastnear.com')){
      transferRequests++;
      return new Response('rate limited',{status:429});
    }
    throw Error('Unexpected provider: '+url);
  };
  const result=await collectWhaleHistory(structuredClone(previous));
  assert.equal(result.sourceRateLimited,true,'Rate limit is reported as a partial refresh');
  assert.equal(result.pendingHistory['alice.near']?.cursor,'saved-page-cursor','Pagination resume cursor is retained');
  assert.equal(result.ledger.length,1,'Prior verified event must survive a partial refresh');
  assert.equal(result.ledger[0].id,'prior');
  assert.equal(result.wallets.length,1,'Prior verified wallet coverage is retained');
  assert.equal(result.periods.M.through,previous.wallets[0].observedThrough,'Common verified cutoff must not advance on failed requests');
  console.log('PASS: 429 keeps the resume cursor, verified ledger and wallet sample.');
}finally{globalThis.fetch=original}
