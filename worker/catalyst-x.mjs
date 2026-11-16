// Owner-supplied X API: strictly bounded, source-backed discovery, never autopublished.
// Reuses the original Talvoryn query and 50 requested-posts/day budget.
const topic=/\b(?:near|intents?|hackathons?|builders?|projects?|submissions?|finalists?|mainnet|launch(?:es|ed|ing)?|live|releas(?:e|ed)|integrat(?:e|ed|ion|ions|ing)|adopt(?:ion|ed)?|volum(?:e|es)|revenues?|buybacks?|inflation|issuance|fees?|burns?|upgrades?|proposals?|partner(?:ship|ships|ed|s)?|security|incident|wallets?|agents?|privacy|grants?|funding|bounties|demo day|deadline|payments?)\b/i;
const iso=()=>new Date().toISOString();
export async function collectXCatalysts(prior={},token,at=iso()){
 const day=at.slice(0,10);
 const budget=prior.budget?.day===day?{...prior.budget}:{day,reservedReads:0};
 if(!token)return {...prior,budget,lastCheckedAt:at,source:{ok:false,code:'not_connected',error:'X bearer token is not configured in Cloudflare secrets'}};
 if(budget.reservedReads>=50)return {...prior,budget,lastCheckedAt:at,source:{ok:true,code:'daily_budget_reached',requestedPosts:budget.reservedReads}};
 if(prior.lastRequestAt&&Date.parse(at)-Date.parse(prior.lastRequestAt)<3600000)return {...prior,budget,source:{ok:true,code:'hourly_cooldown',requestedPosts:budget.reservedReads}};
 // Reserve the full request budget before attempting network access.
 budget.reservedReads+=10;
 const state={...prior,budget,lastRequestAt:at,lastCheckedAt:at};
 const query='(from:NEARProtocol OR from:ilblackdragon) -is:retweet';
 const params=new URLSearchParams({query,max_results:'10','tweet.fields':'created_at,author_id,conversation_id,referenced_tweets',...(prior.sinceId?{since_id:prior.sinceId}:{})});
 try{
  const r=await fetch('https://api.x.com/2/tweets/search/recent?'+params,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'manual'});
  if(!r.ok)throw Error('X API HTTP '+r.status);
  const d=await r.json();if(!Array.isArray(d.data)&&d.data!==undefined)throw Error('Invalid X API response');
  const posts=d.data||[],oldIds=new Set(prior.seenIds||[]),found=[];
  let newest=prior.sinceId||null;
  for(const p of posts){
   if(!/^\d+$/.test(String(p.id))||typeof p.text!=='string')continue;
   if(newest===null||BigInt(p.id)>BigInt(newest))newest=p.id;
   if(oldIds.has(p.id))continue;
   oldIds.add(p.id);
   if(!topic.test(p.text)&&!p.referenced_tweets?.some(x=>x.type==='replied_to'))continue;
   const text=p.text.trim().slice(0,1000);
   found.push({id:'x:'+p.id,title:text.slice(0,180),url:'https://x.com/i/web/status/'+p.id,
    source:'X · watched NEAR accounts',observedAt:p.created_at||at,status:'Team post — source review needed',
    type:'announcement',discoveredAt:at,reviewStatus:'pending',
    evidence:{tweetId:p.id,authorId:p.author_id,conversationId:p.conversation_id,reply:!!p.referenced_tweets?.some(x=>x.type==='replied_to'),excerpt:text}});
  }
  return {...state,sinceId:newest,seenIds:[...oldIds].slice(-200),pending:found,
   source:{ok:true,code:'checked',checkedAt:at,readCount:posts.length,requestedPosts:budget.reservedReads,candidates:found.length}};
 }catch(e){
  return {...state,pending:[],source:{ok:false,code:'request_failed',checkedAt:at,error:String(e.message).slice(0,140),requestedPosts:budget.reservedReads}};
 }
}
