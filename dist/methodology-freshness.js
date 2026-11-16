/* Data Freshness: read actual production observations, never generate dates from the browser clock. */
(() => {
  const root=document.getElementById('methodologyFreshness');
  if(!root)return;
  const tbody=root.querySelector('tbody');
  const status=root.querySelector('[data-freshness-status]');
  const defs=[
    {label:'Intents volume, fees and revenue',schedule:'Hourly',key:'activity'},
    {label:'NEAR, BTC and ETH daily prices',schedule:'Hourly',key:'markets'},
    {label:'Supply observation',schedule:'Hourly',key:'supply-head'},
    {label:'Buyback transfers',schedule:'Hourly',key:'buybacks'},
    {label:'Integrators',schedule:'Hourly',key:'integrators'},
    {label:'Sampled wallet activity',schedule:'Every 3 hours',key:'whales'},
    {label:'Historical issuance and burns',schedule:'Separate research process',key:'supply-history'},
    {label:'Catalyst discovery',schedule:'Hourly source checks',key:'catalyst-discovery'}
  ];
  const cleanDate=x=>{
    if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(x)||!Number.isFinite(Date.parse(x.length===10?x+'T00:00:00Z':x)))return null;
    return x.length===10?x:x.replace(/\.\d+(?=Z$)/,'');
  };
  const shownDate=x=>{
    const c=cleanDate(x);return c||'Unavailable';
  };
  const cell=(tr,value,detail)=>{
    const td=document.createElement('td');td.textContent=value;
    if(detail){const small=document.createElement('small');small.textContent=detail;td.append(document.createElement('br'),small)}
    tr.append(td);
  };
  function render(rows,healthAvailable){
    tbody.replaceChildren();
    for(const item of rows){
      const tr=document.createElement('tr');
      const th=document.createElement('th');th.scope='row';th.textContent=item.label;tr.append(th);
      cell(tr,item.schedule);
      cell(tr,shownDate(item.through),item.note||null);
      cell(tr,shownDate(item.checked));
      tbody.append(tr);
    }
    status.textContent=healthAvailable?'Dates are in UTC. “Data through” describes the observations; “Last successful check” comes from the recorded job result.':'Live source status is unavailable. No refresh dates are assumed.';
  }
  render(defs.map(d=>({...d})),false);
  async function load(){
    try{
      const response=await fetch('/data/source-status.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Source status unavailable');
      const source=await response.json();
      // Don't display the old checked-in snapshot as current operational telemetry.
      if(source.mode!=='dynamic'||!Array.isArray(source.jobs))throw Error('Live job status unavailable');
      const jobs=new Map(source.jobs.map(j=>[j.name,j]));
      const get=k=>jobs.get(k)||{};
      const through=x=>typeof x==='string'?x:null;
      const a=get('activity'),m=get('markets');
      const activityDates=['volume','fees','revenue'].map(k=>through(a.through?.[k])).filter(Boolean).sort();
      const marketDates=['near','btc','eth'].map(k=>through(m.through?.[k])).filter(Boolean).sort();
      const buy=get('buybacks');
      const endExclusive=through(buy.through);
      const buyObserved=endExclusive&&/^\d{4}-\d{2}-\d{2}$/.test(endExclusive)?
        new Date(Date.parse(endExclusive+'T00:00:00Z')-86400000).toISOString().slice(0,10):null;
      const supply=source.finalSupplyObservation||{};
      const historical=source.monthlySupply||{};
      const historicalTo=through(historical.toExclusive);
      const historicalObserved=historicalTo&&/^\d{4}-\d{2}-\d{2}$/.test(historicalTo)?
        new Date(Date.parse(historicalTo+'T00:00:00Z')-86400000).toISOString().slice(0,10):null;
      const fromJob=k=>({checked:get(k).lastSuccess||null,through:through(get(k).through)});
      const rows=[
       {...defs[0],through:activityDates.length===3?activityDates[0]:null,checked:a.lastSuccess, note:activityDates.length===3&&activityDates[0]!==activityDates[2]?'Earliest of three source cutoffs':null},
       {...defs[1],through:marketDates.length===3?marketDates[0]:null,checked:m.lastSuccess,note:marketDates.length===3&&marketDates[0]!==marketDates[2]?'Earliest of three price observations':null},
       {...defs[2],through:through(supply.observedAt)||through(get('supply-head').through),checked:get('supply-head').lastSuccess||null},
       {...defs[3],through:buyObserved,checked:buy.lastSuccess||null,note:buyObserved?'Last completed day (exclusive cutoff)':null},
       {...defs[4],...fromJob('integrators')},
       {...defs[5],...fromJob('whales')},
       {...defs[6],through:historicalObserved,checked:through(historical.retrievedAt),note:historicalObserved?'Historical coverage; not necessarily complete':null},
       {...defs[7],through:get('catalyst-discovery').ok===true?through(get('catalyst-discovery').through)||through(get('catalyst-discovery').lastSuccess):through(get('catalyst-discovery').lastSuccess),checked:get('catalyst-discovery').lastSuccess||null,note:get('catalyst-discovery').ok===false?'Latest check failed; last successful check retained. Discovery is not publication.':'Source discovery only; published stories require separate review'}
      ];
      render(rows,true);
    }catch{
      render(defs.map(d=>({...d})),false);
    }
  }
  load();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
})();
