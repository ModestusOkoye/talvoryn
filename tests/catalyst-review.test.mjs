import assert from 'node:assert/strict';
import {reviewCatalyst} from '../worker/catalyst-review.mjs';
const candidate={id:'near-blog:test',title:'NEAR Intents test launch',url:'https://www.near.org/blog/test',source:'NEAR official blog',type:'announcement'};
const request={
 decision:'approve',eventDate:'2026-11-15',stage:'Announced',kind:'news',affects:['Intents'],
 summary:'NEAR published a development concerning Intents integration and access.',
 effect:'This could make protocol liquidity easier to reach if users adopt it.',
 next:'Check actual integrator routing, fees and revenue after the announcement.',
 evidenceURL:candidate.url
};
const approved=reviewCatalyst(candidate,request,'2026-11-16T00:00:00Z');
assert.equal(approved.record.stage,'Announced');
assert.equal(approved.record.date,'2026-11-15');
assert.throws(()=>reviewCatalyst(candidate,{...request,eventDate:'2027-01-01'},'2026-11-16T00:00:00Z'),/eventDate/);
assert.equal(approved.record.kind,'news');
assert.throws(()=>reviewCatalyst(candidate,{...request,stage:'Shipped'}),/independently linked/);
assert.throws(()=>reviewCatalyst(candidate,{...request,stage:'Measured',evidenceURL:'https://near.org/blog/another'}),/metric source/);
assert.throws(()=>reviewCatalyst(candidate,{...request,evidenceURL:'https://unknown.example/story'}),/evidence URL/);
assert.throws(()=>reviewCatalyst(candidate,{...request,summary:'Price to moon'}),/Source-based/);
const measured=reviewCatalyst(candidate,{...request,stage:'Measured',evidenceURL:'https://near.org/blog/new-release',metricSource:'https://defillama.com/'});
assert.equal(measured.record.stage,'Measured');
assert.equal(reviewCatalyst(candidate,{decision:'reject',reason:'Duplicate'}).decision,'reject');
console.log('Catalyst review approval gates and measured-source requirement passed.');
