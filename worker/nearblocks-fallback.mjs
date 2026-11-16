import {knownExchangeAccount} from './exchange-flows.mjs';
// Bounded, read-only NearBlocks v3 native-NEAR receipts fallback.
// It never treats partial pagination as a completed wallet observation.
// DEX and FT activity still require separate receipt-proven evidence.
const ENDPOINT='https://api.nearblocks.io/v3/accounts/';
export function normalizeNearBlocksReceipt(r,account){
  if(!r||!r.outcome||r.outcome.status!==true||!Array.isArray(r.actions)||r.actions.length!==1||r.actions[0]?.action!=='TRANSFER')return null;
  const sender=r.predecessor_account_id,receiver=r.receiver_account_id;
  if(receiver!==account&&sender!==account)return null;
  if(!sender||!receiver||sender===receiver||!r.receipt_id||!r.transaction_hash||!/^\d+$/.test(String(r.actions_agg?.deposit||'')))return null;
  if(!/^\d+$/.test(String(r.block?.block_height||''))||!/^\d+$/.test(String(r.block_timestamp||r.block?.block_timestamp||'')))return null;
  const amount=BigInt(r.actions_agg.deposit);
  if(amount<=0n)return null;
  return {account_id:account,other_account_id:receiver===account?sender:receiver,
    asset_type:'Near',transfer_type:'NativeTransfer',
    amount:String(receiver===account?amount:-amount),
    block_timestamp:String(r.block_timestamp||r.block.block_timestamp),
    block_height:String(r.block.block_height),
    receipt_id:r.receipt_id,transfer_index:0,transaction_id:r.transaction_hash,
    signer_id:sender,source:'NearBlocks v3 receipts'};
}
export async function fetchNearBlocksWindow(account,from,to,prior={},maxPages=3){
  if(!/^[a-z0-9._-]{2,64}$/.test(account))throw Error('Invalid NEAR account');
  const rows=Array.isArray(prior.rows)?prior.rows:[],next=prior.next??null;
  let cursor=next,lastCursor=null,complete=false,pages=0;
  for(;pages<maxPages;pages++){
    const url=new URL(ENDPOINT+encodeURIComponent(account)+'/receipts');
    url.searchParams.set('limit','25');
    // An explicit upper time boundary keeps every resumed page inside one fixed interval.
    url.searchParams.set('before_ts',String(BigInt(to)*1000000n));
    if(cursor)url.searchParams.set('next',cursor);
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!response.ok){const error=Error('NearBlocks HTTP '+response.status);error.rateLimited=response.status===429;throw error;}
    const payload=await response.json();
    if(!Array.isArray(payload?.data))throw Error('Invalid NearBlocks receipts');
    let oldEnough=false;
    for(const item of payload.data){
      const stamp=item.block_timestamp||item.block?.block_timestamp;
      if(!/^\d+$/.test(String(stamp||'')))throw Error('NearBlocks receipt lacks timestamp');
      const t=Number(BigInt(stamp)/1000000n);
      if(t>=to)continue;
      if(t<from){oldEnough=true;continue;}
      const normalized=normalizeNearBlocksReceipt(item,account);
      if(normalized&&knownExchangeAccount(normalized.other_account_id))rows.push(normalized);
    }
    if(oldEnough||!payload.meta?.next_page){complete=true;cursor=null;break;}
    lastCursor=cursor;cursor=payload.meta.next_page;
    if(cursor===lastCursor)throw Error('NearBlocks repeated cursor');
  }
  return {rows,next:cursor,complete,pages};
}
