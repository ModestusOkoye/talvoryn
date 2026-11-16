// Discovery only: never infer exchange ownership or trading from counterparties.
const MAX_CANDIDATES=160;
const accountPattern=/^[a-z0-9._-]{2,64}$/;
const sample=(v,n)=>Array.isArray(v)?v.slice(0,n):[];
export function collectCounterpartyCandidates(previous,transfers,wallet,known,cohort,now=Date.now()){
 const items=new Map(sample(previous,MAX_CANDIDATES).filter(x=>accountPattern.test(x.account)).map(x=>[x.account,{...x,accounts:sample(x.accounts,48),assets:sample(x.assets,6),sampleReceipts:sample(x.sampleReceipts,3)}]));
 for(const r of transfers){
  const account=r?.other_account_id;
  if(!accountPattern.test(account)||known(account)||cohort.has(account)||account==='system'||account==='wrap.near'||!r.transaction_id||!r.receipt_id)continue;
  const existing=items.get(account)||{account,accounts:[],assets:[],sampleReceipts:[],firstObservedAt:null,lastObservedAt:null,classification:'unverified'};
  const t=Number(BigInt(/^\d+$/.test(String(r.block_timestamp))?String(r.block_timestamp):'0')/1000000n);
  const ts=t>0&&t<now+86400000?new Date(t).toISOString():null;
  existing.accounts=[...new Set([...existing.accounts,wallet])].slice(0,48);
  if(r.asset_type)existing.assets=[...new Set([...existing.assets,String(r.asset_type).slice(0,30)])].slice(0,6);
  const ref=String(r.receipt_id);
  if(!existing.sampleReceipts.includes(ref))existing.sampleReceipts=[...existing.sampleReceipts,ref].slice(-3);
  if(ts){if(!existing.firstObservedAt||ts<existing.firstObservedAt)existing.firstObservedAt=ts;if(!existing.lastObservedAt||ts>existing.lastObservedAt)existing.lastObservedAt=ts;}
  items.set(account,existing);
 }
 return [...items.values()].sort((a,b)=>b.accounts.length-a.accounts.length||(b.lastObservedAt||'').localeCompare(a.lastObservedAt||'')).slice(0,MAX_CANDIDATES);
}
