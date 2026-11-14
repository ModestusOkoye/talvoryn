const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequest(context){
 const path=new URL(context.request.url).pathname;
 if(context.request.method!=='GET')return json({error:'Read-only public API'},405);
 if(!['/api/whales','/api/catalysts','/api/health'].includes(path))return json({error:'Not found'},404);
 if(context.env.DATA_WORKER)return context.env.DATA_WORKER.fetch(context.request);
 if(path==='/api/health')return json({status:'snapshot_only',workerConnected:false,schedulerConfigured:false,message:'Cloudflare Worker and D1 activation are pending'},503);
 const url=new URL(path==='/api/whales'?'/data/whales.json':'/data/economic-catalysts.json',context.request.url);
 const response=await context.next(new Request(url,context.request));
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Talvoryn-Mode','dated-snapshot');return new Response(response.body,{status:response.status,headers});
}
