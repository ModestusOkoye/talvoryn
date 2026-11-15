// Descriptive before/after comparisons; never attribute changes to an announcement.
const DAY=86400000;
const date=t=>new Date(t).toISOString().slice(0,10);
const metrics=['volume','fees','revenue'];
export function catalystImpact(item,performance){
 const day=Date.parse(item?.date+'T00:00:00Z');
 const rows=performance?.daily,cutoff=performance?.meta?.through;
 if(!Number.isFinite(day)||!Array.isArray(rows)||!cutoff)return null;
 // Exclude the announcement day. Compare 7 complete UTC days before with 7 after.
 const before=[],after=[],byDate=new Map(rows.map(r=>[r.date,r]));
 for(let offset=-7;offset<=7;offset++){
  if(!offset)continue;
  const key=date(day+offset*DAY);
  if(key>cutoff)return null;
  const row=byDate.get(key);if(!row||metrics.some(k=>!Number.isFinite(row[k])||row[k]<0))return null;
  (offset<0?before:after).push(row);
 }
 if(before.length!==7||after.length!==7)return null;
 const compare={};
 for(const key of metrics){
  const pre=before.reduce((t,r)=>t+r[key],0),post=after.reduce((t,r)=>t+r[key],0);
  compare[key]={before:pre,after:post,changePct:pre>0?(post/pre-1)*100:null};
 }
 return {method:'Seven complete UTC days before and after; event day excluded',
  before:{from:date(day-7*DAY),through:date(day-DAY)},
  after:{from:date(day+DAY),through:date(day+7*DAY)},
  sourceThrough:cutoff,compare,
  caveat:'Descriptive context only. Cannot establish the catalyst caused these changes.'};
}
