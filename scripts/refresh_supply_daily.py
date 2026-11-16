#!/usr/bin/env python3
"""Daily UTC supply accounting, backed by cached archival RPC block responses."""
import concurrent.futures,datetime as dt,json
from decimal import Decimal
import refresh_supply as s

def collect(start='2026-04-01',end=None):
 end=end or dt.datetime.now(s.UTC).date().isoformat()
 h=s.collect(start,end,workers=2)
 head=s.block(h['meta']['finalisedHead']['hash'])
 days=[];d=dt.date.fromisoformat(start)
 while d.isoformat()<=end:days.append(d.isoformat());d+=dt.timedelta(days=1)
 bounds=dict(h['boundaries'])
 missing=[d for d in days if d not in bounds]
 with concurrent.futures.ThreadPoolExecutor(2) as pool:
  for i,(day,bound) in enumerate(zip(missing,pool.map(lambda d:s.boundary(d,head),missing))):
   bounds[day]=bound
   if i%20==0:print('Daily boundaries',i+1,'/',len(missing),flush=True)
 rows=[]
 for a,b in zip(days,days[1:]):
  events=[e for e in h['issuanceEvents'] if s.ns(a)<=int(e['block']['timestamp_nanosec'])<s.ns(b)]
  mint=sum(int(e['mintedYocto']) for e in events)
  delta=int(bounds[b]['before']['total_supply'])-int(bounds[a]['before']['total_supply'])
  burn=mint-delta
  assert burn>=0
  rows.append({'date':a,'mint':float(Decimal(mint)/10**24),'burn':float(Decimal(burn)/10**24),'mintYocto':str(mint),'burnYocto':str(burn),'startBlock':bounds[a]['before']['hash'],'endBlock':bounds[b]['before']['hash']})
 for m in h['months']:
  r=[r for r in rows if m['from']<=r['date']<m['toExclusive']]
  assert sum(int(x['mintYocto']) for x in r)==int(m['mintYocto'])
  assert sum(int(x['burnYocto']) for x in r)==int(m['burnYocto'])
 result={'meta':h['meta'],'daily':rows,'boundaries':bounds,'dailyMonthlyReconciliation':'passed'}
 (s.OUT/'supply-daily.json').write_text(json.dumps(result,indent=2))
 s.apply(h)
 print('Saved daily supply:',len(rows),'days; exact monthly reconciliation passed',flush=True)
 return result
if __name__=='__main__':collect()
