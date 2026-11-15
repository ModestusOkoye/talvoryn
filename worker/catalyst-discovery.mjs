// Independent, bounded, source-backed discovery. Nothing here auto-publishes a catalyst.
const matchTopic=/(issuance|emissions?|inflation|buybacks?|revenue|fees?|burns?|tokenomics|intents?|chain signatures?|MPC|sharding|privacy|confidential|AI agents?|validators?|governance|upgrades?|security|integrations?|partnerships?|hackathon)/i;
const now=()=>new Date().toISOString();
async function request(url,as='json'){
 const response=await fetch(url,{headers:{Accept:as==='json'?'application/json':'text/html','User-Agent':'Talvoryn-SourceMonitor'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('HTTP '+response.status);
 const body=await response.text();
 if(body.length>1500000)throw Error('Oversized source payload');
 return as==='json'?JSON.parse(body):body;
}
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const good=x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.url==='string';
export function extractHackathonCount(html){
 // Official project directory pagination marker, not a guess from script contents.
 const matches=[...String(html).matchAll(/(?:OF|of)\s+([\d,]{2,8})\s+PROJECTS\b/g)];
 if(!matches.length)return null;
 const unique=[...new Set(matches.map(m=>Number(m[1].replaceAll(',',''))))];
 return unique.length===1&&unique[0]>=0&&unique[0]<1000000?unique[0]:null;
}
export function extractBlogLinks(html){
 const found=new Map();
 for(const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,900}?)<\/a>/gi)){
   let u;try{u=new URL(m[1],'https://www.near.org');}catch{continue}
   if(!['near.org','www.near.org'].includes(u.hostname)||!/^\/blog\/[a-z0-9-]+\/?$/i.test(u.pathname))continue;
   const title=clean(m[2]);if(title.length<15||title.length>220||!matchTopic.test(title))continue;
   const url='https://www.near.org'+u.pathname.replace(/\/$/,'');
   found.set(url,{id:'near-blog:'+u.pathname.replace(/\/$/,'').split('/').at(-1),title,url,source:'NEAR official blog',status:'Announced — confirm implementation',observedAt:now(),type:'announcement'});
 }
 return [...found.values()].slice(0,20);
}
export async function discoverCatalysts(previous={}){
 const observations=[],errors={},sources={};
 async function run(name,fn){try{const outcome=await fn();observations.push(...(outcome.items||[]));sources[name]={ok:true,checkedAt:now(),...(outcome.meta||{})}}catch(e){errors[name]=String(e.message).slice(0,160);sources[name]={ok:false,error:errors[name]}}}
 await run('governance',async()=>{
  const d=await request('https://gov.near.org/latest.json');
  if(!Array.isArray(d.topic_list?.topics))throw Error('Missing topics');
  return {items:d.topic_list.topics.filter(t=>matchTopic.test(t.title||'')).slice(0,12).map(t=>({
   id:'forum:'+t.id,title:clean(t.title).slice(0,180),url:'https://gov.near.org/t/'+t.id,
   source:'NEAR Governance',observedAt:t.bumped_at||t.last_posted_at||t.created_at,status:'Proposed — review pending',type:'proposal'}))};
 });
 await run('github',async()=>{
  const d=await request('https://api.github.com/repos/near/NEPs/pulls?state=all&sort=updated&direction=desc&per_page=30');
  if(!Array.isArray(d))throw Error('Missing pull requests');
  return {items:d.filter(p=>matchTopic.test(p.title||'')).slice(0,12).map(p=>({
   id:'github:near/NEPs:'+p.number,title:clean(p.title).slice(0,180),url:p.html_url,
   source:'NEAR Enhancement Proposals',observedAt:p.updated_at,
   status:p.merged_at?'Merged proposal — implementation not independently verified':'Proposed — review pending',type:'proposal'}))};
 });
 await run('official-blog',async()=>{
  const page=await request('https://www.near.org/blog','html');const found=extractBlogLinks(page);
  if(!found.length)throw Error('No verifiable official blog links parsed');
  return {items:found};
 });
 await run('hackathon',async()=>{
  const page=await request('https://nearhackathon.com/','html');
  const total=extractHackathonCount(page);if(total===null)throw Error('Project count absent or ambiguous in official directory');
  return {items:[],meta:{total,definition:'Public project submissions; not verified launches or unique developers',url:'https://nearhackathon.com/#projects'}};
 });
 const existing=new Map((previous.pending||[]).filter(good).map(x=>[x.id,x]));
 const reviewed=new Set(previous.reviewedIds||[]);
 for(const finding of observations){
  if(!good(finding)||reviewed.has(finding.id))continue;
  const old=existing.get(finding.id);
  existing.set(finding.id,{...old,...finding,discoveredAt:old?.discoveredAt||now(),
   // A discovered/updated URL must never silently inherit a human-reviewed publication status.
   reviewStatus:old?.reviewStatus||'pending',status:old?.status&&old.reviewStatus==='approved'?old.status:finding.status});
 }
 return {pending:[...existing.values()].sort((a,b)=>String(b.observedAt||'').localeCompare(String(a.observedAt||''))).slice(0,180),
  reviewedIds:[...reviewed].slice(-500),lastCheckedAt:now(),sources,
  hackathon:sources.hackathon?.ok?{...sources.hackathon}:previous.hackathon||null};
}
