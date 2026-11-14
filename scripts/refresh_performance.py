#!/usr/bin/env python3
"""Refresh NEAR Lens performance. Python 3 stdlib only.
Run: python scripts/refresh_performance.py [--cached]
Records missing data as null; never extrapolates history or assumes missing=zero.
"""
import argparse,calendar,datetime as dt,json,math,pathlib,statistics,time,urllib.request
from decimal import Decimal
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'dist/data';OUT.mkdir(parents=True,exist_ok=True)
UTC=dt.timezone.utc; START=dt.datetime(2026,4,1,tzinfo=UTC);NOW=dt.datetime.now(UTC); END=NOW.replace(hour=0,minute=0,second=0,microsecond=0)
CACHED=argparse.ArgumentParser();CACHED.add_argument('--cached',action='store_true');cached=CACHED.parse_args().cached
SOURCES={
 'volume':'https://api.llama.fi/summary/dexs/near-intents?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true',
 'fees':'https://api.llama.fi/summary/fees/near-intents?dataType=dailyFees',
 'revenue':'https://api.llama.fi/summary/fees/near-intents?dataType=dailyRevenue'}
errors=[]
def fetch(url,payload=None):
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,data=json.dumps(payload).encode() if payload is not None else None,headers={'Content-Type':'application/json','User-Agent':'NEARLensResearch/1.0'})
   return json.load(urllib.request.urlopen(req,timeout=40))
  except Exception:
   if attempt==2:raise
   time.sleep(attempt+1)
def get(name,url):
 p=OUT/(name+'-raw.json')
 if cached:return json.loads(p.read_text())
 try:
  j=fetch(url);p.write_text(json.dumps(j));return j
 except Exception as e:errors.append(name+': '+str(e));return None
series={}
for k,u in SOURCES.items():
 j=get(k,u);s={}
 if j:
  for t,v in j.get('totalDataChart',[]):
   day=dt.datetime.fromtimestamp(int(t),UTC).date().isoformat()
   if day in s:raise ValueError('Duplicate daily record: '+k+' '+day)
   if not isinstance(v,(int,float)) or not math.isfinite(v) or v<0:raise ValueError('Invalid value: '+k+' '+day)
   s[day]=v
 series[k]=s
if any(not s for s in series.values()):raise RuntimeError('Required activity API unavailable; keeping prior performance.json. '+str(errors))
END=min(END,dt.datetime.fromisoformat(min(max(s) for s in series.values())).replace(tzinfo=UTC)+dt.timedelta(days=1))
prices={}
for k,coin in [('near','near'),('btc','bitcoin'),('eth','ethereum')]:
 u=f'https://coins.llama.fi/chart/coingecko:{coin}?start={int(START.timestamp())}&span={(END-START).days+1}&period=1d';SOURCES[k]=u
 j=get(k,u);s={}
 if j:
  for p in j.get('coins',{}).get('coingecko:'+coin,{}).get('prices',[]):
   t=p['timestamp'];mid=round(t/86400)*86400
   if abs(t-mid)>900 or p['price']<=0:continue
   day=dt.datetime.fromtimestamp(mid,UTC).date().isoformat();s[day]=p['price']
 prices[k]=s
# Query the actual native identifier returned by API, rather than assuming asset_id="near".
buypath=OUT/'buybacks-raw.json';endpoint='https://transfers.main.fastnear.com/v0/transfers';SOURCES['buybacks']=endpoint
if cached:bj=json.loads(buypath.read_text())
else:
 try:
  p={'account_id':'buybacks.multisignature.near','direction':'receiver','limit':100,'desc':False,'from_timestamp_ms':int(START.timestamp()*1000),'to_timestamp_ms':int(END.timestamp()*1000)}
  rows=[];seen=set()
  for page in range(1000):
   j=fetch(endpoint,p);rows.extend(j.get('transfers',[]));token=j.get('resume_token')
   if not token:break
   if token in seen:raise ValueError('Repeated pagination cursor')
   seen.add(token);p['resume_token']=token
  else:raise ValueError('Pagination incomplete')
  bj={'rows':rows,'complete':True,'from':START.date().isoformat(),'toExclusive':END.date().isoformat(),'pages':page+1};buypath.write_text(json.dumps(bj))
 except Exception as e:errors.append('buybacks: '+str(e));bj={'rows':[],'complete':False}
buy={};dedup=set()
for r in bj['rows']:
 if r.get('asset_type')!='Near' or Decimal(r['amount'])<=0:continue
 key=(r['receipt_id'],r['transfer_index'])
 if key in dedup:continue
 dedup.add(key);day=dt.datetime.fromtimestamp(int(r['block_timestamp'])/1e9,UTC).date().isoformat()
 buy[day]=buy.get(day,0)+int(r['amount'])
seeds=json.loads((ROOT/'scripts/historical-seed.json').read_text());seed={f'2026-{i+4:02}':r for i,r in enumerate(seeds)}
days=[];d=START
while d<END:
 day=d.date().isoformat();r={'date':day,**{k:s.get(day) for k,s in series.items()},**{k:s.get(day) for k,s in prices.items()}}
 r['buy']=float(Decimal(buy.get(day,0))/Decimal(10**24)) if bj.get('complete') and bj['from']<=day<bj['toExclusive'] else None
 r['buyUsdEstimate']=r['buy']*r['near'] if r['buy'] is not None and r['near'] is not None else None
 days.append(r);d+=dt.timedelta(days=1)
months=[]
for m in sorted(set(r['date'][:7] for r in days)):
 rows=[r for r in days if r['date'].startswith(m)];n=len(rows);old=seed.get(m,{});complete=n==calendar.monthrange(int(m[:4]),int(m[5:]))[1]
 r={'month':m,'days':n,'complete':complete,'through':rows[-1]['date'],'coverage':{}}
 for k in ['volume','fees','revenue','buy','buyUsdEstimate']:
  vals=[x[k] for x in rows if x[k] is not None];r['coverage'][k]=len(vals);r[k]=sum(vals) if len(vals)==n else None
  if k=='buy' and r[k] is None and 'buy' in old:r[k]=old[k];r['coverage'][k]=n
 r['mint']=old.get('mint');r['burn']=old.get('burn');r['buyPriceEstimate']=old.get('estimate') if m=='2026-09' else (r['buyUsdEstimate']/r['buy'] if r['buy'] and r['buyUsdEstimate'] is not None else None)
 r['buyUsdEstimate']=r['buy']*r['buyPriceEstimate'] if r['buy'] is not None and r['buyPriceEstimate'] is not None else None
 r['feeRate']=r['fees']/r['volume'] if r['volume'] and r['fees'] is not None else None;r['captureRate']=r['revenue']/r['fees'] if r['fees'] and r['revenue'] is not None else None
 r['notes']=[]
 for k in ['volume','fees','revenue']:
  if k in old and r[k] is not None and abs(r[k]-old[k])>max(1,old[k]*.00001):r['notes'].append(k+' differs from saved historical workbook; provider revision requires review')
 if not complete:r['notes'].append('Month in progress. Compare with the same elapsed UTC days in the previous month.')
 if r['mint'] is None:r['notes'].append('Issuance not yet extended beyond September; no current issuance coverage ratio calculated.')
 for x in rows:
  prev=[y['fees'] for y in days if y['date']<x['date'] and y['fees'] is not None][-7:]
  if prev and x['fees'] is not None and x['fees']<statistics.median(prev)*.1:r['notes'].append(x['date']+': fees below 10% of prior 7-record median; reporting or activity change needs review.')
 if old:r['notes'].append('Issuance/burns and April–September buybacks retained from workbook v4; not independently re-collected by this refresh.')
 months.append(r)
# Same elapsed days, with strict daily completeness; never compare partial month to a full month.
for i,r in enumerate(months):
 if i==0:r['growth']={};continue
 previous=months[i-1];oldrows=[x for x in days if x['date'].startswith(previous['month'])][:r['days']] if not r['complete'] else [x for x in days if x['date'].startswith(previous['month'])]
 r['growth']={}
 for k in ['volume','fees','revenue','buy']:
  if r['complete']:
   p=previous[k]
  else:p=sum(x[k] for x in oldrows) if len(oldrows)==r['days'] and all(x[k] is not None for x in oldrows) else None
  r['growth'][k]=(r[k]/p-1) if r[k] is not None and p and p>0 else None
 r['comparison']='previous complete month' if r['complete'] else 'same first '+str(r['days'])+' UTC days of '+previous['month']
meta={'retrievedAt':NOW.isoformat(),'through':days[-1]['date'],'timezone':'UTC','sources':SOURCES,'errors':errors,'buybackPaginationComplete':bj.get('complete',False),'buybackRows':len(dedup),'definitions':{'volume':'USD swap activity; DefiLlama daily series.','fees':'Gross protocol and affiliate swap fees; DefiLlama dailyFees.','revenue':'Revenue-wallet collections excluding internal hops; may lag fees.','buy':'Successful incoming native NEAR to buybacks.multisignature.near; all senders including treasury/refunds; receipt arrival assumed purchase time; unique receipt_id and transfer_index.','buyUsdEstimate':'Incoming NEAR weighted by arrival-day market price; NOT actual purchase expenditure.','mint':'Gross issuance reconstructed at epoch boundaries in existing workbook v4. Current extension not collected.','burn':'Issuance minus total-supply increase from existing workbook v4.','price':'One near-midnight observation per UTC date, tolerance 15 minutes.','market':'BTC benchmark; ETH proxy for one major altcoin, not a broad altcoin total.'}}
result={'meta':meta,'months':months,'daily':days};(OUT/'performance.json').write_text(json.dumps(result,indent=2,allow_nan=False))
import refresh_supply
supply_error=None
if not cached:
 try:
  import refresh_supply_daily
  refresh_supply_daily.collect(START.date().isoformat(),END.date().isoformat())
 except Exception as exc:
  supply_error=str(exc);errors.append('Daily supply collection incomplete: '+supply_error)
if (OUT/'supply-history.json').exists():
 refresh_supply.apply()
 result=json.loads((OUT/'performance.json').read_text())
import build_cached_supply_daily
result['meta']['errors']=errors
(OUT/'performance.json').write_text(json.dumps(result,indent=2,allow_nan=False))
print(json.dumps({'through':result['meta']['through'],'months':len(result['months']),'latest':result['months'][-1],'errors':errors},indent=2))

if supply_error:raise RuntimeError('Daily supply incomplete; saved monthly records preserved. '+supply_error)
