(()=>{'use strict';const $=id=>document.getElementById(id),date=s=>new Date(s+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});let items=[],mode='all',busy=false,page=1;const rail=!!$('railItems'),parent=$(rail?'railItems':'newsFeed'),status=$(rail?'railStatus':'feedStatus'),refreshButton=$(rail?'railRefresh':'refreshFeed');
function valid(item){try{const u=new URL(item.url);return ['https://gov.near.org','https://near.org','https://www.near.org','https://github.com','https://x.com','https://nearblocks.io','https://defillama.com','https://nearhackathon.com','https://near.ai'].includes(u.origin)&&['proposals','news','github','onchain','data'].includes(item.kind)&&Array.isArray(item.affects)&&item.affects.length&&['title','summary','effect','next','date','checkedAt','status'].every(k=>typeof item[k]==='string'&&item[k].length)}catch{return false}}
function simulation(item){return item.simulation==='hsp029'?'./research.html?catalyst=hsp029#offset':item.simulation==='intents-fees'?'./research.html?catalyst=intents-fees#revenue':null}
function detail(item){$('catalystTitle').textContent=item.title;$('catalystSummary').textContent=item.summary;$('catalystEffect').textContent=item.effect;$('catalystNext').textContent=item.next;$('catalystSource').href=item.url;const sim=simulation(item);$('catalystSimulate').hidden=!sim;if(sim)$('catalystSimulate').href=sim;renderProjects(item);
 document.getElementById('impactEvidence')?.remove();
 if(item.impact?.compare){
  const section=document.createElement('section');section.id='impactEvidence';
  const head=document.createElement('h3');head.textContent='Economic observations around this development';section.append(head);
  const time=document.createElement('p');time.textContent='7 full UTC days before ('+item.impact.before.from+'–'+item.impact.before.through+') compared with 7 after ('+item.impact.after.from+'–'+item.impact.after.through+')';section.append(time);
  for(const [name,label]of [['volume','Intents volume'],['fees','Fees'],['revenue','Revenue']]){
   const metric=item.impact.compare[name];if(!metric)continue;
   const p=document.createElement('p');const change=Number.isFinite(metric.changePct)?(metric.changePct>=0?'+':'')+metric.changePct.toFixed(1)+'%':'not comparable';
   p.textContent=label+': '+change+' · descriptive comparison, not attributable impact';section.append(p);
  }
  const caveat=document.createElement('small');caveat.textContent=item.impact.caveat;section.append(caveat);
  $('catalystSource').parentElement.before(section);
 }
 $('catalystDetail').showModal()}
const trackNames={defi:'Unstoppable DeFi',thesis:'Investment Thesis',privacy:'Privacy & Private AI',business:'Autonomous Business',swarms:'AI Swarms',security:'AI Security & Defense',agents:'Agent Economy',money:'Real-World Money',games:'Games With Real Economies',nfts:'NFTs That Do Something',memecoins:'Memecoins With Mechanics',social:'Social Money',open:'Open Innovation'};
function renderProjects(item){
 document.getElementById('eventProjects')?.remove();
 if(item.id!=='near-hackathon-2026')return;
 const box=document.createElement('section');box.id='eventProjects';
 const title=document.createElement('h3');title.textContent='Hackathon project directory';
 const copy=document.createElement('p');copy.textContent='Browse the full public submission list and filter by track on the official hackathon website. Submission does not imply launch or verified adoption.';
 const link=document.createElement('a');link.href='https://nearhackathon.com/#projects';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Explore all submitted projects ↗';
 box.append(title,copy,link);$('catalystSource').parentElement.before(box);
 const tally=document.createElement('p');tally.className='economic-meta';tally.textContent='Checking official directory count…';box.insertBefore(tally,link);
 fetch('/api/catalysts/hackathon',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Unavailable');return r.json()}).then(d=>{
   if(!Number.isInteger(d.total)||d.total<0||!d.checkedAt)throw Error('Invalid count');
   tally.textContent=d.total.toLocaleString('en-US')+' public submissions · checked '+new Date(d.checkedAt).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC · not verified launches';
 }).catch(()=>{tally.textContent='Current directory count unavailable — see official source';});
 const list=document.createElement('div'),nav=document.createElement('div');
 nav.className='project-pager';
 const prev=document.createElement('button'),next=document.createElement('button');
 prev.type='button';next.type='button';prev.textContent='Previous';next.textContent='Next';
 let n=1,requestId=0;
 const load=async()=>{
  const id=++requestId;list.textContent='Loading official project submissions…';
  try{
   const response=await fetch('/api/catalysts/projects?page='+n,{cache:'no-store'});
   if(!response.ok)throw Error('Unavailable');
   const d=await response.json();if(requestId!==id)return;
   list.replaceChildren();
   for(const p of d.projects||[]){
    const row=document.createElement('p'),a=document.createElement('a');
    a.textContent=p.project_name;
    a.href=p.demo_url||'https://nearhackathon.com/#projects';a.target='_blank';a.rel='noopener noreferrer';
    row.append(a);
    const small=document.createElement('small');small.textContent=' · '+(p.tracks||[]).map(t=>trackNames[t]||t).join(', ');
    row.append(small);list.append(row);
   }
   prev.disabled=n<=1;next.disabled=n*(d.pageSize||8)>=d.total;
   tally.textContent=d.total.toLocaleString('en-US')+' submitted projects · page '+n+' · official directory';
  }catch{list.textContent='Project list unavailable — open the official directory';}
 };
 prev.onclick=()=>{if(n>1){n--;load()}};
 next.onclick=()=>{n++;load()};
 nav.append(prev,next);box.insertBefore(list,link);box.insertBefore(nav,link);load();

}
function render(){const railLink=rail?document.querySelector('.catalyst-rail .rail-all'):null;parent.replaceChildren();const selected=items.filter(i=>mode==='all'||i.kind===mode).sort((a,b)=>b.date.localeCompare(a.date));const size=10,pages=Math.max(1,Math.ceil(selected.length/size));page=Math.min(page,pages);for(const item of selected.slice((page-1)*size,page*size)){const button=document.createElement('button');button.type='button';button.className=rail?'rail-item':'economic-item';const title=document.createElement('span');title.className='economic-title';title.textContent=item.title;button.append(title);if(!rail){const meta=document.createElement('small');meta.className='economic-meta';meta.textContent=item.date+' · '+item.status;button.append(meta)}button.dataset.kind=item.kind;button.onclick=()=>detail(item);parent.append(button)}if(!selected.length){const empty=document.createElement('p');empty.className='quiet';empty.textContent='No reviewed catalysts in this category.';parent.append(empty)}let pager=$(rail?'railPages':'feedPages');if(!pager){pager=document.createElement('nav');pager.id=rail?'railPages':'feedPages';pager.className='catalyst-pages';pager.setAttribute('aria-label','Catalyst pages');parent.after(pager)}pager.replaceChildren();if(pages>1){for(let n=Math.max(1,page-2);n<=Math.min(pages,page+2);n++){const b=document.createElement('button');b.textContent=n;b.type='button';b.setAttribute('aria-label','Page '+n);if(n===page)b.setAttribute('aria-current','page');b.onclick=()=>{page=n;render()};pager.append(b)}}if(railLink)pager.append(railLink)}
async function refresh(){
 if(busy)return;busy=true;refreshButton.disabled=true;
 try{
   const responses=await Promise.allSettled([
     fetch('./data/economic-catalysts.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Saved catalyst feed unavailable');return r.json()}),
     fetch('/api/catalysts',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Live catalyst feed unavailable');return r.json()})
   ]);
   const saved=responses[0].status==='fulfilled'?(responses[0].value.items||[]).filter(valid):[];
   const live=responses[1].status==='fulfilled'?(responses[1].value.items||[]).filter(valid):[];
   if(!saved.length&&!live.length)throw Error('No available catalysts');
   const merged=new Map(live.map(item=>[item.id,item]));
   // A more recently verified editorial update replaces a stale item of the same ID.
   for(const item of saved){
     const prior=merged.get(item.id);
     if(!prior||item.checkedAt>=prior.checkedAt)merged.set(item.id,item);
   }
   items=[...merged.values()];
   render();
   status.textContent='';
 }catch{
   status.textContent='Catalyst update unavailable';if(!items.length)render();
 }finally{busy=false;refreshButton.disabled=false}
}
refreshButton.onclick=refresh;document.querySelectorAll('[data-feed]').forEach(b=>b.onclick=()=>{mode=b.dataset.feed;page=1;document.querySelectorAll('[data-feed]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))});render()});$('closeCatalyst').onclick=()=>$('catalystDetail').close();$('catalystDetail').onclick=e=>{if(e.target===$('catalystDetail'))$('catalystDetail').close()};refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);})();
