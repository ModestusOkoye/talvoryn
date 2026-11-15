// Owner-reviewed Catalyst transitions. Discovery alone cannot publish, ship or measure anything.
const stages=new Set(['Proposed','Announced','Shipped','Measured']);
const kinds=new Set(['proposals','news']);
const approvedHosts=new Set(['near.org','www.near.org','gov.near.org','github.com','nearhackathon.com','near.ai','www.near.ai','nearblocks.io','defillama.com']);
const clean=x=>typeof x==='string'?x.trim():'';
export function reviewCatalyst(candidate,request,at=new Date().toISOString()){
 if(!candidate||typeof candidate.id!=='string')throw Error('Candidate not found');
 if(!request||!['approve','reject'].includes(request.decision))throw Error('Invalid review decision');
 if(request.decision==='reject')return {decision:'reject',id:candidate.id,reviewedAt:at,reason:clean(request.reason).slice(0,500)||'Not material'};
 const stage=clean(request.stage);if(!stages.has(stage))throw Error('Stage must be Proposed, Announced, Shipped or Measured');
 const eventDate=clean(request.eventDate);
 if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(eventDate)||!Number.isFinite(Date.parse(eventDate+'T00:00:00Z'))||eventDate>at.slice(0,10))throw Error('Verified actual eventDate (YYYY-MM-DD) required');
 const summary=clean(request.summary),effect=clean(request.effect),next=clean(request.next),evidenceURL=clean(request.evidenceURL);
 if([summary,effect,next].some(x=>x.length<25||x.length>1000))throw Error('Source-based summary, effect and what-to-watch required (25–1000 chars each)');
 let evidence;try{evidence=new URL(evidenceURL);if(evidence.protocol!=='https:'||!approvedHosts.has(evidence.hostname))throw Error('Unapproved evidence host')}catch{throw Error('Valid official or verified evidence URL required')}
 // Shipped and Measured must have evidence separate from the candidate's original announcement.
 if(['Shipped','Measured'].includes(stage)&&evidenceURL===candidate.url)throw Error('Shipped/Measured requires independently linked implementation or measurement evidence');
 if(stage==='Measured'&&!clean(request.metricSource))throw Error('Measured stage requires a metric source and observation');
 if(request.metricSource){
   let metric;try{metric=new URL(request.metricSource);if(metric.protocol!=='https:')throw Error()}catch{throw Error('Invalid metric source URL')}
 }
 return {decision:'approve',id:candidate.id,reviewedAt:at,record:{
  id:candidate.id,kind:kinds.has(request.kind)?request.kind:(candidate.type==='proposal'?'proposals':'news'),
  title:clean(candidate.title).slice(0,180),date:eventDate,checkedAt:at.slice(0,10),
  status:stage+' · owner reviewed',stage,affects:(Array.isArray(request.affects)?request.affects:[]).filter(x=>typeof x==='string'&&x.length<40).slice(0,6).length
   ?request.affects.filter(x=>typeof x==='string'&&x.length<40).slice(0,6):['Ecosystem'],
  summary,effect,next,url:candidate.url,
  source:candidate.source,evidenceURL,metricSource:clean(request.metricSource)||undefined,reviewedAt:at
 }};
}
