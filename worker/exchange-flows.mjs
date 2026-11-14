import EXCHANGE_REGISTRY from './exchange-registry.json' with {type:'json'};
export {EXCHANGE_REGISTRY};
const cexAccounts=new Map(EXCHANGE_REGISTRY.cex.map(x=>[x.account,x]));
const dexAccounts=new Map(EXCHANGE_REGISTRY.dex.map(x=>[x.account,x]));
export const knownExchangeAccount=a=>cexAccounts.has(a)||dexAccounts.has(a);
export const dexAccount=a=>dexAccounts.has(a);
export const transferId=r=>r.account_id+':'+r.receipt_id+':'+r.transfer_index;
const success=s=>s&&('SuccessValue' in s||'SuccessReceiptId' in s);
const nativeAsset=r=>r.asset_type==='Near'||r.asset_type==='Ft'&&['wrap.near','nep141:wrap.near'].includes(r.asset_id);
export function exchangeTransfer(r,proofs=new Map()){
 if(r.asset_type==='Near'&&r.transfer_type!=='NativeTransfer'||r.asset_type==='Ft'&&r.transfer_type!=='FtTransfer')return null;
 if(!nativeAsset(r)||!r.transaction_id||!r.receipt_id||BigInt(r.amount||0)===0n)return null;
 const cex=cexAccounts.get(r.other_account_id);
 if(cex&&!cex.custodian)return {venue:cex.name,venueType:'CEX',kind:BigInt(r.amount)>0n?'CEX withdrawal':'CEX deposit',source:cex.source||EXCHANGE_REGISTRY.cexSource};
 return proofs.get(transferId(r))||null;
}
// A DEX address alone is insufficient: match a successful swap and the exact
// wallet transfer in that transaction's wrap.near receipt. Unproven legs stay out.
export function proveDexTransfer(r,tx){
 const venue=dexAccounts.get(r.other_account_id);
 if(!venue||r.asset_type!=='Ft'||!['wrap.near','nep141:wrap.near'].includes(r.asset_id)||!success(tx?.status)||tx.transaction?.hash!==r.transaction_id||tx.transaction?.signer_id!==r.account_id)return null;
 const outcomes=tx.receipts_outcome||[];
 if(outcomes.some(x=>x.outcome?.status?.Failure))return null;
 const signed=BigInt(r.amount),amount=signed<0n?-signed:signed,incoming=signed>0n;
 let swapAmount=0n;
 for(const o of outcomes){if(o.outcome?.executor_id!==r.other_account_id||!success(o.outcome.status))continue;
  for(const log of o.outcome.logs||[]){
   const m=log.match(/^Swapped (\d+) (\S+) for (\d+) (\S+?)(?:,|$)/);
   if(m){if(incoming&&m[4]==='wrap.near'&&m[2]!=='wrap.near')swapAmount+=BigInt(m[3]);if(!incoming&&m[2]==='wrap.near'&&m[4]!=='wrap.near')swapAmount+=BigInt(m[1]);}
   if(log.startsWith('EVENT_JSON:'))try{const e=JSON.parse(log.slice(11));if(e.standard==='dcl.ref'&&['swap','swap_desire'].includes(e.event))for(const v of e.data||[]){if(v.swapper!==r.account_id)continue;if(incoming&&v.token_out==='wrap.near'&&v.token_in!=='wrap.near')swapAmount+=BigInt(v.amount_out);if(!incoming&&v.token_in==='wrap.near'&&v.token_out!=='wrap.near')swapAmount+=BigInt(v.amount_in);}}catch{}
  }
 }
 if(swapAmount!==amount)return null;
 const receipt=outcomes.find(o=>o.id===r.receipt_id&&o.outcome?.executor_id==='wrap.near'&&success(o.outcome.status));
 if(!receipt)return null;
 const matched=(receipt.outcome.logs||[]).some(log=>{if(!log.startsWith('EVENT_JSON:'))return false;try{const e=JSON.parse(log.slice(11));return e.standard==='nep141'&&e.event==='ft_transfer'&&e.data?.some(v=>v.old_owner_id===(incoming?r.other_account_id:r.account_id)&&v.new_owner_id===(incoming?r.account_id:r.other_account_id)&&BigInt(v.amount)===amount)}catch{return false}});
 return matched?{venue:venue.name,venueType:'DEX',kind:incoming?'DEX buy':'DEX sell',source:venue.source,proof:'Successful swap log and matching wrap.near transfer receipt'}:null;
}
