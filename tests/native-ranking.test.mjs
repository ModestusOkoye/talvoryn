import assert from 'node:assert/strict';
import {classifyNative,verifyNativeBatch} from '../worker/native-ranking.mjs';
const result={amount:'123000000000000000000000000',locked:'0',block_height:42,block_hash:'hash',code_hash:'11111111111111111111111111111111'};
assert.equal(classifyNative('alice.near',result).labelReviewRequired,true);
assert.equal(classifyNative('treasury.near',result).excluded,true);
assert.equal(classifyNative('alice.near',{...result,code_hash:'contract'}).excluded,true);
const objects=new Map(),env={BUCKET:{get:async k=>objects.has(k)?{json:async()=>JSON.parse(objects.get(k))}:null,put:async(k,v)=>objects.set(k,v)}};
const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({result})};
try{
 const baseline={snapshotBlock:42,accounts:Array.from({length:12},(_,i)=>({account_id:`wallet${i}.near`,upperBoundNear:1000000}))};
 const p=await verifyNativeBatch(env,baseline);assert.equal(calls,8);assert.equal(p.checked,8);assert.equal(p.cohortReady,false);
 await verifyNativeBatch(env,baseline);assert.equal(calls,8);
 const saved=JSON.parse(objects.get('private/whales/native-verification.json'));assert.equal(saved.verified.length,8);assert.equal(saved.cursor,8);
}finally{globalThis.fetch=original}
console.log('Native verification persists progress, bounds calls, excludes contracts and never promotes unreviewed candidates.');
