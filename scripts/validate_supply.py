#!/usr/bin/env python3
"""Recheck collected monthly supply values against full saved RPC block responses."""
import datetime as dt,gzip,json,pathlib
from decimal import Decimal
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'dist/data';UTC=dt.timezone.utc
s=json.loads((OUT/'supply-history.json').read_text());blocks={}
for p in (OUT/'supply-evidence').glob('*.json.gz'):
 j=json.load(gzip.open(p,'rt'))
 if j['request']['method']=='block':
  b=j['response']['result'];blocks[b['header']['hash']]=b
ns=lambda d:int(dt.datetime.fromisoformat(d).replace(tzinfo=UTC).timestamp())*10**9
for day,pair in s['boundaries'].items():
 a=blocks[pair['before']['hash']]['header'];b=blocks[pair['after']['hash']]['header']
 assert int(a['timestamp_nanosec'])<ns(day)<=int(b['timestamp_nanosec'])
 assert b['prev_hash']==a['hash']
for e in s['issuanceEvents']:
 b=blocks[e['block']['hash']];h=b['header'];p=blocks[h['prev_hash']]['header']
 assert h['epoch_id']!=p['epoch_id']
 burn=sum(int(c['balance_burnt'])for c in b['chunks']if c['height_included']==h['height'])
 assert int(e['mintedYocto'])==int(h['total_supply'])-int(p['total_supply'])+burn
for a,b in zip(s['issuanceEvents'],s['issuanceEvents'][1:]):assert b['block']['epoch_id']==a['previousBlock']['hash']
checks=[]
for m in s['months']:
 events=[e for e in s['issuanceEvents']if ns(m['from'])<=int(e['block']['timestamp_nanosec'])<ns(m['toExclusive'])]
 assert len(events)==m['epochCount']
 assert sum(int(e['mintedYocto'])for e in events)==int(m['mintYocto'])
 delta=int(blocks[m['endBlock']['hash']]['header']['total_supply'])-int(blocks[m['startBlock']['hash']]['header']['total_supply'])
 assert int(m['mintYocto'])-int(m['burnYocto'])==delta
 assert int(m['burnYocto'])>=0
 checks.append({'month':m['month'],'epochCount':m['epochCount'],'UTCBoundaries':'passed','epochCoverage':'passed','supplyConservation':'passed'})
assert s['meta']['rewardCrossCheck']['matched']
report={'checkedAt':dt.datetime.now(UTC).isoformat(),'allBlockchainChecksPassed':True,'fullBlockResponsesChecked':len(blocks),'months':checks,'rewardCrossCheck':s['meta']['rewardCrossCheck'],'burnMethod':'Inferred from exact issuance minus observed change in total supply','networkFeesCollected':False}
daily_path=OUT/'supply-daily.json'
if daily_path.exists() and json.loads(daily_path.read_text()).get('meta',{}).get('status')!='incomplete':
 daily=json.loads(daily_path.read_text())
 for day,pair in daily['boundaries'].items():
  a=blocks[pair['before']['hash']]['header'];b=blocks[pair['after']['hash']]['header']
  assert int(a['timestamp_nanosec'])<ns(day)<=int(b['timestamp_nanosec']) and b['prev_hash']==a['hash']
 for row in daily['daily']:
  events=[e for e in s['issuanceEvents'] if ns(row['date'])<=int(e['block']['timestamp_nanosec'])<ns(row['date'])+86400*10**9]
  assert sum(int(e['mintedYocto']) for e in events)==int(row['mintYocto'])
  delta=int(blocks[row['endBlock']]['header']['total_supply'])-int(blocks[row['startBlock']]['header']['total_supply'])
  assert int(row['mintYocto'])-int(row['burnYocto'])==delta
 report['dailyRecordsChecked']=len(daily['daily']);report['dailySupplyConservation']='passed'
if daily_path.exists():report['dailyCoverage']=json.loads(daily_path.read_text())['meta']
(OUT/'supply-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
