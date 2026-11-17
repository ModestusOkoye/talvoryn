#!/usr/bin/env python3
"""Merge verified monthly supply into live D1 via existing authenticated Worker API.
Only fills missing values; never changes conflicting verified yocto figures.
"""
import datetime as dt
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("TALVORYN_WORKER_URL", "https://talvoryn-data.paulsimonmodus.workers.dev").rstrip("/")
TOKEN = os.environ.get("OWNER_API_TOKEN")
if not TOKEN:
    sys.exit("OWNER_API_TOKEN GitHub secret is required")

def request(path, data=None, authorized=False):
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if authorized:
        headers["Authorization"] = "Bearer " + TOKEN
    req = urllib.request.Request(URL + path, data=json.dumps(data).encode() if data is not None else None, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.load(response)

incoming = json.loads((ROOT / "dist/data/supply-daily.json").read_text())
report = json.loads((ROOT / "dist/data/supply-validation.json").read_text())
if report.get("allBlockchainChecksPassed") is not True or report.get("dailySupplyConservation") != "passed":
    sys.exit("Refusing unverified supply import")
rows = incoming.get("daily", [])
if not rows or any(not isinstance(r.get("mintYocto"), str) or not isinstance(r.get("burnYocto"), str) for r in rows):
    sys.exit("Incomplete daily yocto accounting")
for r in rows:
    if int(r["mintYocto"]) < 0 or int(r["burnYocto"]) < 0:
        sys.exit("Negative supply amount")
if [r["date"] for r in rows] != sorted(set(r["date"] for r in rows)):
    sys.exit("Duplicate or unordered dates")

live = request("/data/supply-daily.json")
existing = {r["date"]: r for r in live.get("daily", [])}
changed = 0
for row in rows:
    day = row["date"]
    prior = existing.get(day)
    if prior is None:
        existing[day] = row
        changed += 1
        continue
    for field in ("mintYocto", "burnYocto"):
        a, b = prior.get(field), row.get(field)
        if a is not None and b is not None and int(a) != int(b):
            sys.exit(f"Verified conflict at {day} {field}; refusing all changes")
    for field in ("mint", "burn", "mintYocto", "burnYocto", "startBlock", "endBlock"):
        if prior.get(field) is None and row.get(field) is not None:
            prior[field] = row[field]
            changed += 1

merged = {**live, "daily": [existing[k] for k in sorted(existing)]}
merged["meta"] = {**live.get("meta", {}), "lastVerifiedMergeAt": dt.datetime.now(dt.timezone.utc).isoformat(), "lastVerifiedMergeThrough": rows[-1]["date"]}
print(f"Verified merge: {len(rows)} incoming days, {len(merged['daily'])} total days, {changed} additions", flush=True)
if not changed:
    print("No missing values; skipping import")
    sys.exit(0)
result = request("/api/admin/import/supply-daily", merged, authorized=True)
if not result.get("hash"):
    sys.exit("Cloudflare import did not return a dataset hash")
confirmed = request("/data/supply-daily.json")
after = {r["date"]: r for r in confirmed.get("daily", [])}
for row in rows:
    actual = after.get(row["date"])
    if actual is None or any(str(actual.get(k)) != row[k] for k in ("mintYocto", "burnYocto")):
        sys.exit("Live verification failed after import")
print(f"Cloudflare D1 import and verification succeeded: {result['hash']}", flush=True)
request("/api/admin/refresh", {}, authorized=True)
print("Requested live performance refresh", flush=True)
