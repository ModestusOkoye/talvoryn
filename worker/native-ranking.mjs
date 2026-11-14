// Candidate discovery is not proof of a complete current cohort.
export function nativeProgress(state) {
  return {status:'verification_in_progress',snapshotBlock:state.snapshotBlock,total:state.accounts.length,checked:state.cursor,failed:state.failures.length,eligibleCandidates:state.verified.filter(x=>!x.excluded).length,coverageVerified:false,cohortReady:false};
}
export function classifyNative(account,result) {
  if(!result || !/^\d+$/.test(result.amount||'') || !Number.isSafeInteger(result.block_height))throw Error('Invalid account state');
  const contract=result.code_hash!=='11111111111111111111111111111111';
  const operational=/(^binance|^nfendowment|^foundation\.near$|^contributors\.near$|^treasury\.near$|^lockup\.near$|\.poolv1\.near$|^wrap\.near$)/.test(account);
  return {account_id:account,amount:result.amount,locked:result.locked,block:result.block_height,blockHash:result.block_hash,codeHash:result.code_hash,excluded:contract||operational,exclusion:contract?'contract':operational?'known operational account':null,labelReviewRequired:!contract&&!operational};
}
let nativeRunning=null;
export async function verifyNativeBatch(env,baseline) {
  if(nativeRunning)return nativeRunning;
  nativeRunning=(async()=>{
    const object=await env.BUCKET.get('private/whales/native-verification.json');
    const s=object?await object.json():{...structuredClone(baseline),cursor:0,verified:[],failures:[],lastRun:0};
    if(Date.now()-s.lastRun<60000)return nativeProgress(s);
    s.lastRun=Date.now();await env.BUCKET.put('private/whales/native-verification.json',JSON.stringify(s));
    // One bounded run; no NearBlocks credentials or quota used.
    let requests=0;
    for(let n=0;n<8&&requests<10&&s.cursor<s.accounts.length;n++){
      const a=s.accounts[s.cursor++];
      try{
        const request=()=>fetch('https://free.rpc.fastnear.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'near-lens',method:'query',params:{request_type:'view_account',block_id:s.snapshotBlock,account_id:a.account_id}}),signal:AbortSignal.timeout(12000)});
        let r,lastError;for(let attempt=0;attempt<2&&requests<10;attempt++){try{requests++;r=await request();if(r.ok)break;lastError=Error('RPC HTTP '+r.status)}catch(e){lastError=e}}if(!r)throw lastError;
        if(!r.ok)throw Error('RPC HTTP '+r.status);
        const d=await r.json();if(d.error)throw Error('RPC account unavailable');
        const v=classifyNative(a.account_id,d.result);if(v.block!==s.snapshotBlock)throw Error('Snapshot mismatch');
        s.verified.push({...v,upperBoundNear:a.upperBoundNear});
      }catch(e){s.failures.push({account_id:a.account_id,error:String(e.message).slice(0,100)});}
      await env.BUCKET.put('private/whales/native-verification.json',JSON.stringify(s));
      if(s.failures.length&&s.failures.at(-1).account_id===a.account_id)break;
    }
    await env.BUCKET.put('private/whales/native-candidates.json',JSON.stringify(baseline));
    return nativeProgress(s);
  })().finally(()=>nativeRunning=null);return nativeRunning;
}
