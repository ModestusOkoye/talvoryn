// Low-cost public-source Catalyst discovery. Candidates are never auto-published.
const accepted=/(?:\bissuance\b|\bemissions?\b|\binflation\b|\bbuybacks?\b|\brevenue\b|\bfees?\b|\bburns?\b|\btokenomics\b|\bintents?\b|\bchain signatures?\b|\bMPC\b|\bsharding\b|\bprivacy\b|\bconfidential\b|\bAI agents?\b|\bvalidators?\b|\bgovernance\b|\bupgrades?\b|\bsecurity\b|\bintegrations?\b|\bpartnerships?\b)/i;
const iso=()=>new Date().toISOString();
const get=async url=>{
 const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Talvoryn-SourceMonitor'},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Source HTTP '+r.status);
 return r.json();
};
const valid=x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.url==='string';
export async function discoverCatalysts(previous={}){
 const observations=[],errors={};
 const run=async(name,fn)=>{try{const found=await fn();observations.push(...found)}catch(e){errors[name]=String(e.message).slice(0,160)}};
 await run('governance',async()=>{
  const data=await get('https://gov.near.org/latest.json');
  if(!Array.isArray(data.topic_list?.topics))throw Error('Missing topics');
  return data.topic_list.topics.filter(t=>accepted.test(t.title||'')).slice(0,12).map(t=>({
    id:'forum:'+t.id+':'+(t.bumped_at||t.last_posted_at||t.created_at),
    title:String(t.title).slice(0,180),url:'https://gov.near.org/t/'+t.id,
    source:'NEAR Governance',observedAt:t.bumped_at||t.last_posted_at||t.created_at,
    status:'Needs source review'}));
 });
 await run('github',async()=>{
  const data=await get('https://api.github.com/repos/near/NEPs/pulls?state=all&sort=updated&direction=desc&per_page=30');
  if(!Array.isArray(data))throw Error('Missing pull requests');
  return data.filter(p=>accepted.test(p.title||'')).slice(0,12).map(p=>({
   id:'github:near/NEPs:'+p.number+':'+p.updated_at,title:String(p.title).slice(0,180),
   url:p.html_url,source:'NEAR Enhancement Proposals',observedAt:p.updated_at,
   status:p.merged_at?'Merged — verify significance':'Needs source review'}));
 });
 const known=new Map((previous.pending||[]).filter(valid).map(x=>[x.id,x]));
 const reviewed=new Set(previous.reviewedIds||[]);
 for(const finding of observations)if(valid(finding)&&!reviewed.has(finding.id)&&!known.has(finding.id))
   known.set(finding.id,{...finding,discoveredAt:iso()});
 return {pending:[...known.values()].sort((a,b)=>b.observedAt.localeCompare(a.observedAt)).slice(0,150),
  reviewedIds:[...reviewed].slice(-500),lastCheckedAt:iso(),sources:{
   governance:{ok:!errors.governance,error:errors.governance||null},
   github:{ok:!errors.github,error:errors.github||null}}};
}
