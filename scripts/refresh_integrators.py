"""Refresh the saved NearStats integrator windows without changing app mappings."""
import json,urllib.request
from pathlib import Path
request=urllib.request.Request('https://nearstats.org/api/integrators.json',headers={'User-Agent':'NEARLens/1.0','Accept':'application/json'})
data=json.load(urllib.request.urlopen(request,timeout=45))
assert data.get('ready'), 'Source not ready; previous snapshot retained'
for key in ['24h','7d','30d','all']:
 window=data['windows'][key]
 assert window.get('available') and window.get('rows'), key+' unavailable; previous snapshot retained'
 assert len({row['slug'] for row in window['rows']})==len(window['rows']), 'Duplicate integrators'
 assert all(row['volumeUsd']>=0 and row['swaps']>=0 for row in window['rows']), 'Invalid activity'
Path('dist/integrators-data.json').write_text(json.dumps(data,separators=(',',':')))
print('Saved integrator periods through',data['dataEndsAt'])
