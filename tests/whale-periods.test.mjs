import assert from 'node:assert/strict';
import {whalePeriods,mergeWhaleHistory} from '../worker/whales.mjs';
import {EXCHANGE_REGISTRY} from '../worker/exchange-flows.mjs';
const day=86400000,now=Date.parse('2026-11-14T04:00:00Z'),iso=t=>new Date(t).toISOString(),roster=[{account:'alice.near'}],wallet={...roster[0],historyFrom:iso(now-31*day),observedThrough:iso(now),unverifiedDexTransfers:0};
const event=(id,age,amount)=>({id,account:'alice.near',counterparty:'binance1.near',kind:amount>0?'CEX withdrawal':'CEX deposit',transaction:'tx'+id,timestamp:iso(now-age*day),amount});
const state={revision:5,registry:EXCHANGE_REGISTRY,roster,wallets:[wallet],ledger:[event('d',.5,10),event('w',3,-5),event('m',20,100),event('expired',31,500)]};
const result=whalePeriods(state,now);assert.equal(result.periods.D.net,10);assert.equal(result.periods.W.net,5);assert.equal(result.periods.M.net,105);assert(result.periods.M.complete);assert.equal(result.ledger.length,3);
const duplicate=whalePeriods({...state,ledger:[...state.ledger,state.ledger[0]]},now);assert.equal(duplicate.periods.M.net,105);
const incomplete=whalePeriods({...state,wallets:[{...wallet,historyFrom:iso(now-4*day)}]},now);assert(incomplete.periods.D.complete);assert(!incomplete.periods.W.complete);assert(!incomplete.periods.M.complete);
const retained=mergeWhaleHistory(result,{roster,wallets:[],ledger:[],through:iso(now+60000)});assert.equal(retained.periods.M.net,105);assert.equal(retained.wallets[0].observedThrough,wallet.observedThrough);
const replaced=mergeWhaleHistory(result,{roster,wallets:[{...wallet,refreshedFrom:iso(now-day),observedThrough:iso(now+60000)}],ledger:[event('d',.5,12)],through:iso(now+60000)});assert.equal(replaced.periods.M.net,107);assert.equal(replaced.periods.D.net,12);
const rolled=whalePeriods({...result,wallets:[{...wallet,observedThrough:iso(now+day)}]},now+day);assert.equal(rolled.periods.D.net,0);assert.equal(rolled.periods.W.net,5);assert.equal(rolled.periods.M.net,105);
console.log('Rolling 24h/7d/30d cutoffs, complete coverage, deduplication, incremental replacement and cached failure retention passed.');

const delayed=whalePeriods({...state,wallets:[{...wallet,observedThrough:iso(now-day)}]},now);assert.equal(delayed.periods.D.through,iso(now-day));assert.equal(delayed.ledger.filter(e=>e.id==='d').length,1,'ahead-of-cutoff events stay saved until common coverage advances');
