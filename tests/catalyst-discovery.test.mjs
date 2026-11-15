import assert from 'node:assert/strict';
import {discoverCatalysts,extractBlogLinks,extractHackathonCount} from '../worker/catalyst-discovery.mjs';

assert.equal(extractHackathonCount('<span>1–8 OF 2,438 PROJECTS</span>'),2438);
assert.equal(extractHackathonCount('unavailable'),null);
assert.equal(extractHackathonCount('1–8 OF 2,438 PROJECTS and 1–8 OF 2,439 PROJECTS'),null);
assert.equal(extractBlogLinks('<a href="/blog/near-intents-launch"><img alt="NEAR Intents launches institutional access"></a>').length,1);

const original=globalThis.fetch,calls=[];
try {
 globalThis.fetch=async url=>{
  calls.push(String(url));
  if(String(url).includes('gov.near.org'))return Response.json({topic_list:{topics:[
   {id:14,title:'NEAR emission change proposal',bumped_at:'2026-11-14T20:00:00Z'},
   {id:15,title:'Community social update',bumped_at:'2026-11-14T20:00:00Z'}]}});
  if(String(url).includes('api.github.com'))return Response.json([
   {number:22,title:'Protocol fee adjustment',updated_at:'2026-11-14T19:00:00Z',html_url:'https://github.com/near/NEPs/pull/22'},
   {number:23,title:'Improve format',updated_at:'2026-11-14T19:00:00Z',html_url:'https://github.com/near/NEPs/pull/23'}]);
  if(String(url).includes('nearhackathon.com'))return new Response('<span>1–8 OF 2,438 PROJECTS</span>');
  if(String(url).includes('near.org/blog'))return new Response('<a href="/blog/near-intents-launch"><img alt="NEAR Intents launches institutional access"></a>');
  throw Error('Unexpected URL');
 };
 const first=await discoverCatalysts();
 assert.equal(first.pending.length,3);
 assert.equal(first.hackathon.total,2438);
 assert(Object.values(first.sources).every(s=>s.ok));
 const again=await discoverCatalysts(first);
 assert.equal(again.pending.length,3,'Stable IDs prevent duplicates when sources update');
 const reviewed=await discoverCatalysts({...again,pending:again.pending.slice(1),reviewedIds:[again.pending[0].id]});
 assert.equal(reviewed.pending.length,2,'Reviewed candidates do not reappear');
 assert.equal(calls.length,12);
 console.log('Source discovery, official count extraction and stable deduplication passed.');
}finally {globalThis.fetch=original}
