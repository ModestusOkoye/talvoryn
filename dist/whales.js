(()=>{
 const slot=document.getElementById('whaleAccumulationSlot');if(!slot)return;
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e};
 const fmt=n=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
 const exact=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(n);
 const date=t=>new Date(t).toLocaleString('en-GB',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC';
 const link=(name,url)=>{const a=make('a',name);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a};
 let data,snapshot,selected='M';const periodButtons=new Map();const heading=make('h2','Whale Accumulation'),head=make('div',null,'whale-heading'),periods=make('div',null,'whale-periods');
 const info=make('button','ⓘ','whale-info');info.type='button';info.setAttribute('aria-label','Whale Accumulation data and methodology');
 const title=make('div',null,'whale-title');title.append(heading,info);
 for(const p of ['D','W','M']){const b=make('button',p);b.type='button';b.setAttribute('aria-label',({D:'Daily',W:'Weekly',M:'Monthly'})[p]);b.setAttribute('aria-pressed',String(p==='M'));b.disabled=true;b.onclick=()=>{selected=p;render()};periodButtons.set(p,b);periods.append(b)}
 const score=make('button','—','whale-score');score.type='button';score.setAttribute('aria-label','View whale exchange activity');
 const bar=make('div',null,'whale-bar'),pointer=make('span',null,'whale-pointer'),scale=make('div',null,'whale-scale');pointer.hidden=true;bar.append(pointer);scale.append(make('span','Outflows'),make('span','Neutral'),make('span','Inflows'));head.append(title,periods);slot.replaceChildren(head,score,bar,scale);
 const dialog=make('dialog',null,'drawer economic-dialog whale-dialog');dialog.setAttribute('aria-label','Whale activity details');document.body.append(dialog);
 const close=make('button','×','close');close.type='button';close.setAttribute('aria-label','Close whale details');close.onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close()};
 function show(){
  dialog.replaceChildren(close,make('h2','Whale Accumulation'));
  dialog.append(make('p','We follow a sample of large wallets that held at least 100,000 NEAR when checked. Inflows are NEAR received from a known centralised exchange or bought through a verified decentralised exchange swap. Outflows are NEAR sent to an exchange or sold through a verified swap.'),make('p','Transfers between ordinary wallets are excluded. The figure shows inflows minus outflows.'));
  dialog.showModal();
 }

 info.onclick=show;score.onclick=show;
 function clear(){score.textContent='—';score.classList.remove('inflow','outflow');pointer.hidden=true}
 function render(){
  data=snapshot?.periods?.[selected]?{...snapshot,...snapshot.periods[selected]}:null;
  for(const [p,b] of periodButtons){b.disabled=!snapshot?.periods?.[p]?.complete;b.setAttribute('aria-pressed',String(p===selected));b.title=b.disabled?'History verification incomplete':({D:'Last 24 hours',W:'Last 7 days',M:'Last 30 days'})[p]}
  clear();if(!data?.complete||!Number.isFinite(data.net))return;
  score.textContent=(data.net>0?'+':data.net<0?'−':'')+fmt(Math.abs(data.net))+' NEAR';score.classList.toggle('inflow',data.net>0);score.classList.toggle('outflow',data.net<0);const total=data.incoming+data.outgoing;pointer.hidden=total<=0;pointer.style.left=Math.max(0,Math.min(100,total>0?100*data.incoming/total:50))+'%';bar.setAttribute('aria-label',total>0?'Inflows are '+Math.round(100*data.incoming/total)+'% of verified exchange flows':'No qualifying exchange volume');
 }
 async function load(){try{const r=await fetch('/api/whales',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Unavailable');snapshot=await r.json();render()}catch{clear()}}

 load();setInterval(()=>{if(!document.hidden)load()},60000);
})();
