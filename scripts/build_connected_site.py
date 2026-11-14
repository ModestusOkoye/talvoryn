#!/usr/bin/env python3
"""Bundle the existing static site and its connected catalyst backend into one Worker."""
from pathlib import Path
import json,gzip,base64,mimetypes
root=Path(__file__).resolve().parents[1];dist=root/'dist';assets={}
for p in dist.rglob('*'):
 if not p.is_file() or 'server' in p.relative_to(dist).parts or '.openai'in p.parts or 'supply-evidence'in p.parts:continue
 if p.suffix not in ['.html','.md','.js','.css','.json','.csv','.svg','.png','.jpg','.ico','.woff','.woff2']:continue
 rel='/'+p.relative_to(dist).as_posix();assets[rel]={'type':mimetypes.guess_type(p.name)[0]or'application/octet-stream','body':base64.b64encode(gzip.compress(p.read_bytes(),mtime=0)).decode()}
seedfile=root/'worker/seed.json';seed=json.loads(seedfile.read_text())if seedfile.exists()else {**json.loads((dist/'data/economic-catalysts.json').read_text()),'pending':[],'sources':{}}
collect=(root/'worker/collectors.mjs').read_text().replace('export ','')
exchange_registry=json.loads((root/'worker/exchange-registry.json').read_text())
exchange=(root/'worker/exchange-flows.mjs').read_text().replace("import EXCHANGE_REGISTRY from './exchange-registry.json' with {type:'json'};", 'const EXCHANGE_REGISTRY='+json.dumps(exchange_registry,separators=(',',':'))+';').replace('export {EXCHANGE_REGISTRY};','').replace('export ','')
whales=exchange+'\n'+(root/'worker/whales.mjs').read_text().replace("import {EXCHANGE_REGISTRY,knownExchangeAccount,dexAccount,transferId,exchangeTransfer,proveDexTransfer} from './exchange-flows.mjs';",'').replace('export ','')
whale_seed=json.loads((root/'worker/whale-seed.json').read_text()) if (root/'worker/whale-seed.json').exists() else {'wallets':[],'score':None,'ok':False}
worker=(root/'worker/index.mjs').read_text().replace("import {collectPublic,collectX,mergeState} from './collectors.mjs';",'')
worker=worker.replace("import {collectWhales,mergeWhaleSnapshots,collectWhaleHistory,whalePeriods} from './whales.mjs';",'')
native=(root/'worker/native-ranking.mjs').read_text().replace('export ','')
worker=worker.replace("import {verifyNativeBatch,nativeProgress} from './native-ranking.mjs';",'')
native_seed=json.loads((root/'worker/native-candidates.json').read_text())
code='const NATIVE_CANDIDATES='+json.dumps(native_seed,separators=(',',':'))+';\n'+native+'\n'+'const WHALE_SEED='+json.dumps(whale_seed,separators=(',',':'))+';\n'+whales+'\n'+'const ASSETS='+json.dumps(assets,separators=(',',':'))+';\nconst SEED='+json.dumps(seed,separators=(',',':'))+';\n'+collect+'\n'+worker
out=dist/'server/index.js';out.parent.mkdir(exist_ok=True);out.write_text(code)
print(f'Worker built: {len(assets)} assets, {len(code):,} bytes; secrets excluded.')
