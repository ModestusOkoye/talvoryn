#!/usr/bin/env python3
"""Expose only daily figures provable from saved blocks; never fill missing days."""
import datetime as dt,gzip,json
from decimal import Decimal
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'dist/data';UTC=dt.timezone.utc
blocks={}
for p in (OUT/'supply-evidence').glob('*.json.gz'):
 j=json.load(gzip.open(p,'rt'))
 if j['request']['method']=='block':
  b=j['response']['result'];blocks[b['header']['hash']]=b
ns=lambda d:int(dt.datetime.fromisoformat(d).replace(tzinfo=UTC).timestamp())*10**9
events=[];bounds={}
for b in blocks.values():
 h=b['header'];prev=blocks.get(h['prev_hash'])
 if not prev:continue
 p=prev['header'];a=dt.datetime.fromtimestamp(int(p['timestamp_nanosec'])/1e9,UTC).date();z=dt.datetime.fromtimestamp(int(h['timestamp_nanosec'])/1e9,UTC).date()
 if z!=a:bounds[z.isoformat()]={'before':p,'after':h}
 if h['epoch_id']!=p['epoch_id']:
  burnt=sum(int(c['balance_burnt']) for c in b['chunks'] if c['height_included']==h['height'])
  mint=int(h['total_supply'])-int(p['total_supply'])+burnt;assert mint>=0
  events.append({'block':h,'previousBlock':p,'mintedYocto':mint})
events.sort(key=lambda e:e['block']['height'])
D=json.loads((OUT/'performance.json').read_text());rows=[]
for r in D['daily']:
 day=r['date'];end=(dt.date.fromisoformat(day)+dt.timedelta(days=1)).isoformat()
 before=[i for i,e in enumerate(events) if int(e['block']['timestamp_nanosec'])<=ns(day)]
 after=[i for i,e in enumerate(events) if int(e['block']['timestamp_nanosec'])>=ns(end)]
 mint=None;burn=None
 if before and after:
  segment=events[before[-1]:after[0]+1]
  if all(b['block']['epoch_id']==a['previousBlock']['hash'] for a,b in zip(segment,segment[1:])):
   mint=sum(e['mintedYocto'] for e in segment if ns(day)<=int(e['block']['timestamp_nanosec'])<ns(end))
 if mint is not None and day in bounds and end in bounds:
  delta=int(bounds[end]['before']['total_supply'])-int(bounds[day]['before']['total_supply']);burn=mint-delta;assert burn>=0
 row={'date':day,'mint':float(Decimal(mint)/10**24) if mint is not None else None,'burn':float(Decimal(burn)/10**24) if burn is not None else None,'mintYocto':str(mint) if mint is not None else None,'burnYocto':str(burn) if burn is not None else None}
 if burn is not None:row.update(startBlock=bounds[day]['before']['hash'],endBlock=bounds[end]['before']['hash'])
 rows.append(row)
meta={'from':D['daily'][0]['date'],'toExclusive':(dt.date.fromisoformat(D['meta']['through'])+dt.timedelta(days=1)).isoformat(),'status':'incomplete','reason':'Public archival RPC and block-data API returned HTTP 429. Authenticated archival access is required to finish daily coverage.','issuanceDays':sum(r['mint'] is not None for r in rows),'burnDays':sum(r['burn'] is not None for r in rows),'expectedDays':len(rows),'sources':['https://archival-rpc.mainnet.fastnear.com','https://mainnet.neardata.xyz'],'method':'Daily issuance from complete consecutive epoch coverage. Burns only where exact UTC boundary supply records are available. Null means missing; never monthly-average interpolation.'}
if meta['issuanceDays']==len(rows) and meta['burnDays']==len(rows):meta.update(status='complete',reason=None)
(OUT/'supply-daily.json').write_text(json.dumps({'meta':meta,'daily':rows,'boundaries':bounds},indent=2));print(json.dumps(meta,indent=2))
