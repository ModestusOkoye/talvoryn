"""Fetch Santiment TOTAL2. Never fill gaps or replace a failed response."""
import argparse,json,urllib.request
from pathlib import Path
from datetime import datetime,timezone
p=argparse.ArgumentParser();p.add_argument('--from-date',default='2026-04-01');p.add_argument('--to-date',default=datetime.now(timezone.utc).date().isoformat());a=p.parse_args()
query='{getMetric(metric:"total_market_2_marketcap_usd"){timeseriesDataJson(slug:"total_market",from:"'+a.from_date+'T00:00:00Z",to:"'+a.to_date+'T00:00:00Z",interval:"1d")}}'
r=urllib.request.Request('https://api.santiment.net/graphql',data=query.encode(),headers={'Content-Type':'application/graphql'})
j=json.load(urllib.request.urlopen(r,timeout=45))
if j.get('errors'):raise RuntimeError(str(j['errors']))
rows=j['data']['getMetric']['timeseriesDataJson']
if isinstance(rows,str):rows=json.loads(rows)
rows=[{'date':x['datetime'][:10],'value':x['value']} for x in rows if isinstance(x.get('value'),(int,float)) and x['value']>0]
if not rows:raise SystemExit('No TOTAL2 observations returned for requested dates; saved data unchanged.')
out={'meta':{'source':'Santiment','metric':'total_market_2_marketcap_usd','definition':'Total tracked crypto market capitalization excluding Bitcoin; includes Ethereum and stablecoins.','sourceUrl':'https://academy.santiment.net/metrics/marketcap/'},'daily':rows}
Path('dist/data/altcoin-total.json').write_text(json.dumps(out))
print('Saved',len(rows),'observations:',rows[0]['date'],'to',rows[-1]['date'])
