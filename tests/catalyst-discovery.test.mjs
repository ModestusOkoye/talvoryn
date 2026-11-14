import assert from 'node:assert/strict';
import {discoverCatalysts} from '../worker/catalyst-discovery.mjs';
const original=globalThis.fetch;
const calls=[];
try{
 globalThis.fetch=async url=>{
  calls.push(url);
  if(url.includes('gov.near.org'))return Response.json({topic_list:{topics:[
   {id:14,title:'NEAR emission change proposal',bumped_at:'2026-11-14T20:00:00Z'},
   {id:15,title:'Community social update',bumped_at:'2026-11-14T20:00:00Z'}]}});
  return Response.json([
   {number:22,title:'Protocol fee adjustment',updated_at:'2026-11-14T19:00:00Z',html_url:'https://github.com/near/NEPs/pull/22'},
   {number:23,title:'Improve format',updated_at:'2026-11-14T19:00:00Z',html_url:'https://github.com/near/NEPs/pull/23'}]);
 };
 const first=await discoverCatalysts();
 assert.equal(first.pending.length,2);
 assert(first.pending.every(x=>x.status.includes('review')));
 const again=await discoverCatalysts(first);
 assert.equal(again.pending.length,2,'Candidates deduplicate on refresh');
 const reviewed=await discoverCatalysts({...again,pending:again.pending.slice(1),reviewedIds:[again.pending[0].id]});
 assert.equal(reviewed.pending.length,1,'Reviewed candidates do not reappear');
 assert.equal(calls.length,6);
 console.log('Catalyst public source candidate filtering, bounded discovery and deduplication passed.');
}finally{globalThis.fetch=original}
