"""Fit exploratory conditional weekly models; validate chronologically against market-only and flat-price benchmarks."""
import json,datetime,math
from pathlib import Path
import numpy as np
D=json.loads(Path('dist/data/performance.json').read_text()); daily={r['date']:r for r in D['daily']}; keys=['volume','revenue','buy'];weeks=[]
start=datetime.date.fromisoformat(D['daily'][0]['date']);start+=datetime.timedelta(days=(-start.weekday())%7)
while True:
 dates=[(start+datetime.timedelta(days=i)).isoformat()for i in range(7)];end=(start+datetime.timedelta(days=7)).isoformat()
 if end>D['daily'][-1]['date']:break
 if all(x in daily for x in dates) and end in daily:
  a=daily[dates[0]];b=daily[end]
  if all(a.get(k,0)>0 and b.get(k,0)>0 for k in ['near','btc']):
   w={'date':dates[0],'nearReturn':math.log(b['near']/a['near']),'btcReturn':math.log(b['btc']/a['btc'])}
   for k in keys:w[k]=sum(daily[x][k]for x in dates) if all(isinstance(daily[x].get(k),(int,float))for x in dates) else None
   weeks.append(w)
 start+=datetime.timedelta(days=7)
def fit(X,y):
 X=np.asarray(X);y=np.asarray(y);means=X.mean(axis=0);scales=X.std(axis=0);scales[scales<1e-9]=1
 Z=(X-means)/scales;A=np.column_stack([np.ones(len(X)),Z]);pen=np.eye(A.shape[1])*2;pen[0,0]=0;b=np.linalg.solve(A.T@A+pen,A.T@y)
 return {'intercept':float(b[0]-np.sum(b[1:]*means/scales)),'coefficients':(b[1:]/scales).tolist()}
def pred(m,x):return m['intercept']+sum(a*b for a,b in zip(m['coefficients'],x))
out={'meta':{'through':D['meta']['through'],'method':'Ridge regression on non-overlapping complete weekly log returns: NEAR ~ BTC + contemporaneous log activity change. Expanding chronological one-week holdouts; realized activity and BTC are conditional inputs, not advance predictions. No causal price elasticity claimed.','weeks':len(weeks),'minimumTrainingWeeks':16,'ridgePenalty':2},'models':{},'weeks':weeks}
for key in keys:
 pairs=[]
 for a,b in zip(weeks,weeks[1:]):
  if a[key] is not None and b[key] is not None and a[key]>0 and b[key]>0:pairs.append({'x':[b['btcReturn'],math.log(b[key]/a[key])],'y':b['nearReturn']})
 if len(pairs)<20:continue
 actual=[];full=[];market=[];res=[];market_res=[]
 for n in range(16,len(pairs)):
  train=pairs[:n];m=fit([r['x']for r in train],[r['y']for r in train]);bm=fit([[r['x'][0]]for r in train],[r['y']for r in train]);y=pairs[n]['y'];p=pred(m,pairs[n]['x']);actual.append(y);full.append(p);market.append(pred(bm,[pairs[n]['x'][0]]));res.append(y-p);market_res.append(y-market[-1])
 mae=lambda v:float(np.mean(np.abs(np.array(actual)-v)))
 m=fit([r['x']for r in pairs],[r['y']for r in pairs]);m.update({'marketOnlyModel':fit([[r['x'][0]]for r in pairs],[r['y']for r in pairs]),'pairs':len(pairs),'holdouts':len(actual),'mae':mae(full),'marketOnlyMAE':mae(market),'flatPriceMAE':mae(np.zeros(len(actual))),'residuals':res,'marketOnlyResiduals':market_res,'validatedForecast':False,'status':'conditional_scenario','note':'Fitted activity association is exploratory. Holdouts condition on realized activity and BTC; they do not validate an unconditional forecast. Range uses resampled centered weekly holdout errors, not a calibrated confidence interval.'});out['models'][key]=m
 print(key,'weeks',len(pairs),'holdouts',len(actual),'MAE',round(m['mae'],4),'market',round(m['marketOnlyMAE'],4),'flat',round(m['flatPriceMAE'],4),'coeff',m['coefficients'])
Path('dist/data/research-models.json').write_text(json.dumps(out,indent=2))
