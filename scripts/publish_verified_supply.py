#!/usr/bin/env python3
"""Safely append blockchain-verified daily supply to the live D1 dataset."""
import datetime as dt
import json
import os
import sys
import urllib.request
import urllib.error
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = (os.environ.get("TALVORYN_WORKER_URL") or "https://talvoryn-data.paulsimonmodus.workers.dev").rstrip("/")
TOKEN = os.environ.get("OWNER_API_TOKEN")
PROTECTED_BEFORE = "2026-11-01"

def require(condition, message):
    if not condition:
        sys.exit("SAFE PUBLISH REFUSED: " + message)

RETRYABLE_READ_STATUSES = {429, 500, 502, 503, 504}
MAX_READ_ATTEMPTS = 3

def request(path, data=None, authorized=False):
    """Retry only GET requests; never blindly replay a possibly committed POST."""
    headers = {"Accept": "application/json", "User-Agent": "Talvoryn-diagnostic/1.0"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if authorized:
        require(bool(TOKEN), "OWNER_API_TOKEN missing")
        headers["Authorization"] = "Bearer " + TOKEN
    method = "POST" if data is not None else "GET"
    payload = json.dumps(data).encode() if data is not None else None
    attempts = MAX_READ_ATTEMPTS if method == "GET" else 1
    for attempt in range(attempts):
        req = urllib.request.Request(URL + path, data=payload, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            details = {"path": path, "method": method, "status": error.code,
                       "server": error.headers.get("Server"),
                       "cfRay": error.headers.get("CF-Ray"),
                       "cfMitigated": error.headers.get("cf-mitigated")}
            if method == "GET" and error.code in RETRYABLE_READ_STATUSES and attempt + 1 < attempts:
                print("Transient read error; retry", attempt + 2, "of", attempts, "status", error.code, flush=True)
                time.sleep(min(2 ** attempt, 4))
                continue
            sys.exit("SAFE PUBLISH HTTP ERROR: " + json.dumps(details))
        except (TimeoutError, urllib.error.URLError) as error:
            if method == "GET" and attempt + 1 < attempts:
                print("Transient read transport failure; retry", attempt + 2, "of", attempts, flush=True)
                time.sleep(min(2 ** attempt, 4))
                continue
            sys.exit("SAFE PUBLISH TRANSPORT ERROR: " + json.dumps(
                {"path": path, "method": method, "errorType": type(error).__name__,
                 "writeOutcome": "unknown; verify readback before any manual retry" if method == "POST" else "no write attempted"}))

def indexed(rows, label):
    require(isinstance(rows, list), label + " daily rows missing")
    dates = [r["date"] for r in rows]
    require(dates == sorted(set(dates)), label + " dates duplicated or unordered")
    return {r["date"]: r for r in rows}

def validate():
    incoming = json.loads((ROOT / "dist/data/supply-daily.json").read_text())
    report = json.loads((ROOT / "dist/data/supply-validation.json").read_text())
    require(report.get("allBlockchainChecksPassed") is True and report.get("dailySupplyConservation") == "passed", "blockchain validation failed")
    require(incoming.get("dailyMonthlyReconciliation") == "passed", "monthly reconciliation failed")
    rows = indexed(incoming.get("daily"), "incoming")
    require(bool(rows), "no incoming days")
    today = dt.datetime.now(dt.timezone.utc).date()
    for day, row in rows.items():
        parsed = dt.date.fromisoformat(day)
        require(day >= PROTECTED_BEFORE and parsed < today, "protected or incomplete UTC day: " + day)
        for field in ("mintYocto", "burnYocto", "startBlock", "endBlock"):
            require(isinstance(row.get(field), str) and bool(row[field]), "missing verified " + field + " on " + day)
        require(int(row["mintYocto"]) >= 0 and int(row["burnYocto"]) >= 0, "negative yocto on " + day)
    boundaries = incoming.get("boundaries")
    require(isinstance(boundaries, dict), "incoming boundary evidence missing")
    for day in rows:
        next_day = (dt.date.fromisoformat(day) + dt.timedelta(days=1)).isoformat()
        require(day in boundaries and next_day in boundaries, "boundary evidence missing for " + day)
    return incoming, rows

def merge(incoming, rows, live):
    old = indexed(live.get("daily"), "live")
    original_protected = {d: json.dumps(r, sort_keys=True) for d, r in old.items() if d < PROTECTED_BEFORE}
    updated = {d: dict(r) for d, r in old.items()}
    new_days = []
    for day, row in rows.items():
        prior = updated.get(day)
        if prior is None:
            updated[day] = dict(row)
            new_days.append(day)
            continue
        for field in ("mintYocto", "burnYocto", "startBlock", "endBlock"):
            require(prior.get(field) is not None and str(prior[field]) == str(row[field]), "existing day differs: " + day + " " + field)
        for field in ("mint", "burn"):
            if prior.get(field) is not None:
                require(abs(float(prior[field]) - float(row[field])) < 1e-8, "existing amount differs: " + day + " " + field)
    require(all(json.dumps(updated[d], sort_keys=True) == value for d, value in original_protected.items()), "historical rows changed")
    existing_boundaries = dict(live.get("boundaries") or {})
    for day, evidence in incoming["boundaries"].items():
        if day in existing_boundaries:
            require(existing_boundaries[day] == evidence, "boundary evidence conflict: " + day)
        else:
            existing_boundaries[day] = evidence
    merged = dict(live)
    merged["daily"] = [updated[d] for d in sorted(updated)]
    merged["boundaries"] = existing_boundaries
    merged["meta"] = {**live.get("meta", {}), "lastVerifiedMergeThrough": max(rows), "lastVerifiedMergeAt": dt.datetime.now(dt.timezone.utc).isoformat()}
    return merged, new_days, original_protected

def main():
    incoming, rows = validate()
    live = request("/data/supply-daily.json")
    merged, new_days, protected = merge(incoming, rows, live)
    print("Checked", len(rows), "verified days;", len(new_days), "new days;", len(protected), "protected historical rows", flush=True)
    if not new_days:
        print("No new dates; no production write needed", flush=True)
        return
    require(bool(TOKEN), "OWNER_API_TOKEN missing")
    # Recheck immediately before the write to avoid overwriting an updated dataset.
    latest = request("/data/supply-daily.json")
    require(latest == live, "live dataset changed since comparison")
    result = request("/api/admin/import/supply-daily", merged, authorized=True)
    require(bool(result.get("hash")), "Cloudflare import did not return a hash")
    confirmed = request("/data/supply-daily.json")
    after = indexed(confirmed.get("daily"), "confirmed")
    for day, row in rows.items():
        require(day in after, "missing published day " + day)
        for field in ("mintYocto", "burnYocto", "startBlock", "endBlock"):
            require(str(after[day].get(field)) == str(row[field]), "readback mismatch " + day + " " + field)
    for day, serialized in protected.items():
        require(json.dumps(after.get(day), sort_keys=True) == serialized, "protected history changed: " + day)
    print("Published and verified", len(new_days), "new dates, hash:", result["hash"], flush=True)
    request("/api/admin/refresh", {}, authorized=True)
    print("Requested performance refresh", flush=True)

if __name__ == "__main__":
    main()
