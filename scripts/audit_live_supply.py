#!/usr/bin/env python3
"""Read-only pre-publication audit of Talvoryn live D1-backed public endpoints."""
import datetime as dt
import json
import pathlib
import urllib.request
from decimal import Decimal

ROOT=pathlib.Path(__file__).resolve().parents[1]
URL="https://talvoryn-data.paulsimonmodus.workers.dev"
OUT=ROOT/"supply-live-audit.json"
results=[]
def check(name,ok,detail):
    results.append({"check":name,"status":"PASS" if ok else "FAIL","detail":detail})
    print(("PASS" if ok else "FAIL"),name,detail,flush=True)
def get(path):
    req=urllib.request.Request(URL+path,headers={"Accept":"application/json","User-Agent":"Talvoryn-readonly-audit/1.0"})
    with urllib.request.urlopen(req,timeout=35) as response:
        return json.load(response)
def rowmap(obj):
    rows=obj.get("daily")
    if not isinstance(rows,list):raise ValueError("Missing daily array")
    dates=[r["date"] for r in rows]
    if len(set(dates))!=len(dates):raise ValueError("Duplicate dates")
    return {r["date"]:r for r in rows}
def same(a,b):
    return a is not None and b is not None and str(a)==str(b)

try:
    live=get("/data/supply-daily.json")
    reference=json.loads((ROOT/"dist/data/supply-daily.json").read_text())
    production=rowmap(live);baseline=rowmap(reference)
    check("Live D1 supply dataset readable",True,str(len(production))+" daily rows")
    conflicts=[]
    protected=0
    for date,old in baseline.items():
        if date>="2026-11-01":continue
        current=production.get(date)
        if current is None:
            conflicts.append(date+": missing")
            continue
        for field in ("mintYocto","burnYocto","startBlock","endBlock"):
            if old.get(field) is not None:
                protected+=1
                if not same(old[field],current.get(field)):
                    conflicts.append(date+":"+field)
    check("April-October historical protection",not conflicts,{"referenceFieldsChecked":protected,"conflicts":conflicts[:30],"conflictCount":len(conflicts)})
    expected_start=dt.date(2026,11,1)
    days=[(expected_start+dt.timedelta(days=i)).isoformat() for i in range(16)]
    nov=[production.get(day) for day in days]
    complete=all(r and r.get("mintYocto") is not None and r.get("burnYocto") is not None for r in nov)
    check("November 1-16 daily coverage",complete,{"daysCovered":sum(bool(r and r.get("mintYocto") is not None and r.get("burnYocto") is not None) for r in nov),"required":16})
    if complete:
        mint=sum(int(r["mintYocto"]) for r in nov)
        burn=sum(int(r["burnYocto"]) for r in nov)
        expected_mint=Decimal("1446354.6394266835")
        expected_burn=Decimal("13575.74391097887")
        check("November 1-16 verified totals",abs(Decimal(mint)/10**24-expected_mint)<Decimal("0.00000001") and abs(Decimal(burn)/10**24-expected_burn)<Decimal("0.00000001"),{"issuanceNEAR":str(Decimal(mint)/10**24),"burnsNEAR":str(Decimal(burn)/10**24)})
    else:
        check("November 1-16 verified totals",False,"Cannot compare until all 16 live daily rows exist")
    try:
        perf=get("/data/performance.json")
        pmap=rowmap(perf)
        discrepancies=[]
        for day in days:
            if day in production and day in pmap:
                a,b=production[day],pmap[day]
                for k in ("mint","burn"):
                    if a.get(k) is not None and b.get(k) is not None and abs(float(a[k])-float(b[k]))>0.00001:
                        discrepancies.append(day+":"+k)
        check("Performance matches D1 supply on overlapping populated days",not discrepancies,{"conflicts":discrepancies[:30],"count":len(discrepancies)})
    except Exception as e:
        check("Performance endpoint readable",False,str(e))
except Exception as e:
    check("Live D1 supply dataset readable",False,str(e))
output={"checkedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"worker":URL,"readOnly":True,"results":results,"allPassed":bool(results) and all(r["status"]=="PASS" for r in results)}
OUT.write_text(json.dumps(output,indent=2))
print("AUDIT_RESULT", "PASS" if output["allPassed"] else "FAIL",flush=True)
raise SystemExit(0 if output["allPassed"] else 1)
