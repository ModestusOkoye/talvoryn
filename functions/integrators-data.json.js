export async function onRequestGet(context){
 if(context.env.DATA_WORKER)return context.env.DATA_WORKER.fetch(context.request);
 return context.next();
}
