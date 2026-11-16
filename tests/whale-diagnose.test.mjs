import assert from 'node:assert/strict';
import {diagnoseWhaleTransfer} from '../worker/whales.mjs';
const oldFetch=globalThis.fetch;
const data={roster:[{account:'alice.near'}],pendingHistory:{'alice.near':{provider:'fastnear',from:1,to:2,reason:'Error'}}};
let calls=0;
try{
 globalThis.fetch=async (url,opts)=>{
  calls++;assert.equal(opts.headers.Authorization,'Bearer fake-test-key');
  return Response.json({error:{code:422,message:'fake provider message',secret:'SHOULD_NOT_LEAK'}},{status:200});
 };
 const result=await diagnoseWhaleTransfer(data,'fake-test-key');
 assert.equal(calls,1);
 assert.equal(result.ok,false);
 assert.equal(result.httpStatus,200);
 assert.deepEqual(result.responseKeys,['error']);
 assert.equal(result.errorCode,422);
 assert(!JSON.stringify(result).includes('SHOULD_NOT_LEAK'));
 assert(!JSON.stringify(result).includes('fake-test-key'));
 assert(!JSON.stringify(result).includes('alice.near'));
 console.log('PASS: one-request authenticated diagnostic, schema only, no secret or wallet leakage');
}finally{globalThis.fetch=oldFetch;}
