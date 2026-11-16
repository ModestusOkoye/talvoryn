import assert from 'node:assert/strict';
import {collectXCatalysts} from '../worker/catalyst-x.mjs';
const original=globalThis.fetch;let requests=0;
try{
 globalThis.fetch=async(url,opts)=>{
  requests++;assert.equal(new URL(url).hostname,'api.x.com');
  assert.equal(opts.headers.Authorization,'Bearer test-owner-token');
  assert.equal(new URL(url).searchParams.get('max_results'),'10');
  return Response.json({data:[{id:'1999999999999999999',text:'NEAR Intents integration launches with new partner',created_at:'2026-11-16T00:00:00Z'},
  {id:'1999999999999999998',text:'Nice weather today',created_at:'2026-11-16T00:00:00Z'}]});
 };
 let state=await collectXCatalysts({},'test-owner-token','2026-11-16T00:00:00Z');
 assert.equal(state.source.ok,true);
 assert.equal(state.budget.reservedReads,10);
 assert.equal(state.pending.length,1);
 state=await collectXCatalysts(state,'test-owner-token','2026-11-16T00:10:00Z');
 assert.equal(state.budget.reservedReads,10,'Cooldown does not spend');
 for(let hour=1;hour<=4;hour++)state=await collectXCatalysts(state,'test-owner-token',new Date(Date.parse('2026-11-16T00:00:00Z')+hour*3600000).toISOString());
 assert.equal(state.budget.reservedReads,50);
 assert.equal(requests,5);
 state=await collectXCatalysts(state,'test-owner-token','2026-11-16T06:00:00Z');
 assert.equal(requests,5,'No requests after 50-post limit');
 assert.equal(state.source.code,'daily_budget_reached');
 const absent=await collectXCatalysts({},null,'2026-11-16T00:00:00Z');
 assert.equal(absent.source.code,'not_connected');
 assert.equal(requests,5);
 console.log('X discovery, private auth, cooldown, daily 50-post cap and no-token path passed');
}finally{globalThis.fetch=original}
