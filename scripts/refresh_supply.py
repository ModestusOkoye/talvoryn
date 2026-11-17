#!/usr/bin/env python3
"""Exact NEAR epoch issuance and supply-reconciled burns; Python stdlib only.
Default window: missing October onward, completed UTC days. No annual-rate estimates.
Every successful RPC response is cached with its request and retrieval time.
"""
import argparse,concurrent.futures,csv,datetime as dt,gzip,hashlib,json,os,pathlib,threading,time,urllib.request,urllib.error
from decimal import Decimal, getcontext
getcontext().prec=80
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'dist/data';CACHE=OUT/'supply-evidence';CACHE.mkdir(parents=True,exist_ok=True)
RPC=os.environ.get('NEAR_RPC_URL','https://archival-rpc.mainnet.fastnear.com');UTC=dt.timezone.utc
pace=threading.Lock();last_request=0

def rpc(method,params):
 global last_request
 req={'jsonrpc':'2.0','id':'near-lens-supply','method':method,'params':params}
 key=hashlib.sha256(json.dumps(req,sort_keys=True).encode()).hexdigest();p=CACHE/(key+'.json.gz')
 immutable='finality'not in params and 'latest'not in params
 if immutable and p.exists():return json.load(gzip.open(p,'rt'))['response']['result']
 for attempt in range(6):
  try:
   with pace:
    time.sleep(max(0,1.25-(time.monotonic()-last_request)));last_request=time.monotonic()
   headers={'Content-Type':'application/json','User-Agent':'NEARLensResearch/1.0'}
   if os.environ.get('FASTNEAR_API_KEY'):headers['Authorization']='Bearer '+os.environ['FASTNEAR_API_KEY']
   q=urllib.request.Request(RPC,data=json.dumps(req).encode(),headers=headers)
   with urllib.request.urlopen(q,timeout=35) as r:j=json.load(r)
   if 'error'in j:raise ValueError(str(j['error']))
   record={'endpoint':RPC,'request':req,'retrievedAt':dt.datetime.now(UTC).isoformat(),'response':j}
   tmp=p.with_suffix('.tmp-'+str(threading.get_ident()))
   with gzip.open(tmp,'wt') as f:json.dump(record,f,separators=(',',':'))
   tmp.replace(p);return j['result']
  except ValueError:raise
  except urllib.error.HTTPError as e:
   if e.code in (400, 401, 403, 404, 422):
    detail=e.read(1600).decode('utf-8',errors='replace')
    safe_params={k:(v if k!='block_id' else str(v)[:100]) for k,v in params.items()}
    raise RuntimeError(f'RPC HTTP {e.code} method={method} params={safe_params} response={detail[:900]}') from e
   if attempt==5:raise
   time.sleep((15 if e.code==429 else 2)*(attempt+1))
  except Exception:
   if attempt==5:raise
   time.sleep(2*(attempt+1))

def block(h):return rpc('block',{'block_id':h})
def missing_height(error):
 message=str(error).lower()
 return any(x in message for x in ('unknown_block','db_not_found','unknown block','block not found','block does not exist','not found','unprocessable entity'))
def produced_at_or_before(height,limit=80):
 # Only used for numerical heights: a skipped height is not an epoch boundary.
 for distance in range(limit):
  candidate=height-distance
  if candidate<1:break
  try:return block(candidate)
  except (ValueError,RuntimeError) as error:
   if not missing_height(error):raise
 raise RuntimeError(f'No produced block found in [{max(1,height-limit+1)}, {height}]')

def ns(d):return int(dt.datetime.fromisoformat(d).replace(tzinfo=UTC).timestamp())*10**9
def stamp(b):return int(b['header']['timestamp_nanosec'])
def slim(b):return {k:b['header'][k]for k in ['height','hash','prev_hash','epoch_id','next_epoch_id','timestamp_nanosec','total_supply','latest_protocol_version']}
def produced(h):return produced_at_or_before(h)

def boundary(day,head):
 # Hints are previously verified heights, never accepted without timestamp/link checks.
 hints={'2026-09-01':213761242,'2026-10-01':217984974,'2026-11-01':222491356,'2026-11-11':223988378}
 target=ns(day);lo=0;hi=head['header']['height'];guess=hints.get(day,max(1,hi-int((stamp(head)-target)/570000000)));prevpoint=None
 for _ in range(70):
  b=produced(guess);h=b['header']['height'];t=stamp(b)
  if t>=target:
   prev=block(b['header']['prev_hash'])
   if stamp(prev)<target:return {'before':slim(prev),'after':slim(b)}
   hi=h
  else:lo=h
  if hi-lo<=1:
   b=produced(hi);prev=block(b['header']['prev_hash']);assert stamp(prev)<target<=stamp(b)
   return {'before':slim(prev),'after':slim(b)}
  speed=(t-prevpoint[1])/(h-prevpoint[0])if prevpoint and h!=prevpoint[0]and t!=prevpoint[1]else 570000000
  candidate=h+int((target-t)/speed);prevpoint=(h,t)
  if not lo<candidate<hi:candidate=(lo+hi)//2
  if candidate==guess:candidate+=1 if t<target else -1
  guess=max(lo+1,min(hi,candidate))
 raise RuntimeError('UTC boundary unresolved')

def export_csv(data):
 fields=['month','from','toExclusive','issuanceNEAR','burnedNEAR','supplyChangeNEAR','epochCount','startBlockHeight','endBlockHeight','startBlockHash','endBlockHash','source']
 with (OUT/'supply-monthly.csv').open('w',newline='')as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
  for m in data['months']:
   cv=lambda k:str(Decimal(m[k])/Decimal(10**24))
   w.writerow({'month':m['month'],'from':m['from'],'toExclusive':m['toExclusive'],'issuanceNEAR':cv('mintYocto'),'burnedNEAR':cv('burnYocto'),'supplyChangeNEAR':cv('supplyChangeYocto'),'epochCount':m['epochCount'],'startBlockHeight':m['startBlock']['height'],'endBlockHeight':m['endBlock']['height'],'startBlockHash':m['startBlock']['hash'],'endBlockHash':m['endBlock']['hash'],'source':RPC})

def collect(start='2026-10-01',end=None,workers=8):
 end=end or dt.datetime.now(UTC).date().isoformat();head=rpc('block',{'finality':'final'});latest=rpc('validators',{'latest':None});assert ns(end)<=stamp(head)
 dates={start,end};d=dt.date.fromisoformat(start).replace(day=1)
 while d.isoformat()<end:dates.add(d.isoformat());d=(d.replace(day=28)+dt.timedelta(days=4)).replace(day=1)
 dates=sorted(d for d in dates if start<=d<=end)
 print('Resolving UTC period boundaries',flush=True)
 with concurrent.futures.ThreadPoolExecutor(3)as pool:bounds=dict(zip(dates,pool.map(lambda d:boundary(d,head),dates)))
 print('UTC boundaries verified',flush=True)
 config=rpc('EXPERIMENTAL_protocol_config',{'block_id':head['header']['hash']});length=config['epoch_length'];begin=bounds[start]['before']['height'];last=bounds[end]['after']['height'];probes=list(range(begin,last+1,length-200))+[last]
 def event(probe):
  sample=produced_at_or_before(probe);prev=block(sample['header']['next_epoch_id'])
  for d in range(1,51):
   try:b=block(prev['header']['height']+d);break
   except (ValueError,RuntimeError) as e:
    if not missing_height(e):raise
  else:raise RuntimeError('Missing epoch successor')
  h=b['header'];p=prev['header'];assert h['prev_hash']==p['hash']and h['epoch_id']!=p['epoch_id']
  burnt=sum(int(c['balance_burnt'])for c in b['chunks']if c['height_included']==h['height']);mint=int(h['total_supply'])-int(p['total_supply'])+burnt;assert mint>=0
  return {'block':slim(b),'previousBlock':slim(prev),'boundaryBurnYocto':str(burnt),'mintedYocto':str(mint)}
 byhash={}
 with concurrent.futures.ThreadPoolExecutor(workers)as pool:
  for i,e in enumerate(pool.map(event,probes)):
   byhash[e['block']['hash']]=e
   if i%20==0:print(f'Checked epoch batch {i+1}/{len(probes)}',flush=True)
 events=sorted(byhash.values(),key=lambda e:e['block']['height'])
 for a,b in zip(events,events[1:]):assert b['block']['epoch_id']==a['previousBlock']['hash'],f'Epoch gap at {a["block"]["height"]} to {b["block"]["height"]}'
 assert int(events[0]['block']['timestamp_nanosec'])<=ns(start)
 assert events[-1]['block']['timestamp_nanosec']>=ns(end),'Missing closing epoch coverage'
 paid=None
 if last>=latest['epoch_start_height']:
  paid=sum(int(v)for v in latest['validator_reward_paid_prev_epoch'].values())
  assert paid==int(events[-2]['mintedYocto']),'Reward-map cross-check failed'
 months=[]
 for a,b in zip(dates,dates[1:]):
  es=[e for e in events if ns(a)<=int(e['block']['timestamp_nanosec'])<ns(b)];mint=sum(int(e['mintedYocto'])for e in es);delta=int(bounds[b]['before']['total_supply'])-int(bounds[a]['before']['total_supply']);burn=mint-delta;assert burn>=0
  cv=lambda v:float(Decimal(v)/Decimal(10**24))
  months.append({'month':a[:7],'from':a,'toExclusive':b,'mint':cv(mint),'burn':cv(burn),'mintYocto':str(mint),'burnYocto':str(burn),'supplyChangeYocto':str(delta),'epochCount':len(es),'startBlock':bounds[a]['before'],'endBlock':bounds[b]['before']})
 data={'meta':{'retrievedAt':dt.datetime.now(UTC).isoformat(),'from':start,'toExclusive':end,'rpc':RPC,'method':'At each epoch start, issuance = block total_supply minus previous total_supply plus balance_burnt in newly included chunks. Period burns = collected issuance minus observed change in total supply. Burns are inferred, not a transaction-fee sum.','accountingSource':'https://github.com/near/nearcore/blob/9f88300a66a52872b9432dde3287d11e42831e91/core/primitives/src/block.rs','rewardCrossCheck':{'responseEpoch':latest['epoch_height'] if paid is not None else None,'paidAtBlock':events[-2]['block']['hash'] if paid is not None else None,'mintedYocto':str(paid) if paid is not None else None,'matched':True if paid is not None else None,'status':'not_applicable_historical_window' if paid is None else 'passed'},'finalisedHead':slim(head),'networkFeesCollected':False},'months':months,'boundaries':bounds,'issuanceEvents':events}
 (OUT/'supply-history.json').write_text(json.dumps(data,indent=2));export_csv(data)
 print(json.dumps({'months':[{k:m[k]for k in ['month','mint','burn','epochCount']}for m in months],'allChecksPassed':True},indent=2),flush=True);return data

def apply(history=None):
 history=history or json.loads((OUT/'supply-history.json').read_text());p=OUT/'performance.json';data=json.loads(p.read_text());changes=[]
 for m in data['months']:
  chain=next((r for r in history['months']if r['month']==m['month']),None)
  if not chain:continue
  expected=(dt.date.fromisoformat(m['through'])+dt.timedelta(days=1)).isoformat()
  if chain['from']!=m['month']+'-01'or chain['toExclusive']!=expected:continue
  m.update(mint=chain['mint'],burn=chain['burn'],netIssuance=chain['mint']-chain['burn'],supplySource='supply-history.json',supplyEpochCount=chain['epochCount'])
  m['notes']=[n for n in m['notes']if 'Issuance not yet extended'not in n and 'Issuance/burns and'not in n]
  m['notes'].append('Issuance: exact epoch-boundary blockchain records. Burns: issuance minus observed supply change. Raw RPC evidence retained.')
  changes.append(m['month'])
 data['meta']['sources']['supply']=RPC;data['meta']['supplyCoverage']=history['meta'];data['meta']['definitions']['mint']='Gross issuance from exact epoch-boundary supply and burn records for the collected history.';data['meta']['definitions']['burn']='Issuance minus observed total-supply increase across UTC boundaries; inferred network-wide burns.'
 p.write_text(json.dumps(data,indent=2,allow_nan=False));return changes

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--start',default='2026-10-01');p.add_argument('--end');p.add_argument('--workers',type=int,default=8);p.add_argument('--cached',action='store_true');p.add_argument('--apply',action='store_true');a=p.parse_args()
 history=json.loads((OUT/'supply-history.json').read_text())if a.cached else collect(a.start,a.end,a.workers)
 if a.apply:print('Updated months:',apply(history),flush=True)
