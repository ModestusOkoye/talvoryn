import assert from 'node:assert/strict';
import {catalystImpact} from '../worker/catalyst-impact.mjs';
const start=Date.parse('2026-10-01T00:00:00Z');
const daily=Array.from({length:25},(_,i)=>({
 date:new Date(start+i*86400000).toISOString().slice(0,10),
 volume:i<10?10:20,fees:i<10?2:3,revenue:i<10?1:2
}));
const performance={daily,meta:{through:'2026-10-25'}};
const result=catalystImpact({date:'2026-10-10'},performance);
assert(result);
assert.equal(result.before.from,'2026-10-03');
assert.equal(result.after.through,'2026-10-17');
assert(result.compare.volume.changePct>0);
assert.equal(catalystImpact({date:'2026-10-22'},performance),null,'Incomplete post-event window is not compared');
assert.equal(catalystImpact({date:'2026-10-01'},performance),null,'Absent pre-event data is not silently zero');
assert.equal(catalystImpact({date:'2026-10-10'},{...performance,daily:daily.filter(r=>r.date!=='2026-10-12')}),null,'Missing days suppress the comparison');
console.log('Matched completed-period Catalyst metric comparisons passed.');
