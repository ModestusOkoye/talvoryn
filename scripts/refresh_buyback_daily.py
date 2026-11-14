#!/usr/bin/env python3
"""Refresh incoming native NEAR receipts from April, preserving API pagination evidence."""
import datetime as dt,json,time,urllib.request
from decimal import Decimal
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'dist/data'
def collect():
 end=(dt.date.fromisoformat(json.loads((OUT/'performance.json').read_text())['meta']['through'])+dt.timedelta(days=1)).isoformat()
 ms=lambda d:int(dt.datetime.fromisoformat(d).replace(tzinfo=dt.timezone.utc).timestamp()*1000)
 p={'account_id':'buybacks.multisignature.near','direction':'receiver','limit':100,'desc':False,'from_timestamp_ms':ms('2026-04-01'),'to_timestamp_ms':ms(end)}
 rows=[];seen=set()
 for page in range(1000):
  for attempt in range(6):
   try:
    req=urllib.request.Request('https://transfers.main.fastnear.com/v0/transfers',data=json.dumps(p).encode(),headers={'Content-Type':'application/json'})
    j=json.load(urllib.request.urlopen(req,timeout=40));break
   except Exception:
    if attempt==5:raise
    time.sleep(3*(attempt+1))
  rows.extend(j.get('transfers',[]));token=j.get('resume_token')
  if page%10==0:print('Buyback pages:',page+1,flush=True)
  if not token:break
  assert token not in seen;seen.add(token);p['resume_token']=token;time.sleep(.3)
 else:raise RuntimeError('Pagination incomplete')
 data={'rows':rows,'complete':True,'from':'2026-04-01','toExclusive':end,'pages':page+1}
 (OUT/'buybacks-raw.json').write_text(json.dumps(data))
 print('Saved buyback receipts:',len(rows),flush=True)
if __name__=='__main__':collect()
