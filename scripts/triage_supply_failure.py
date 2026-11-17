#!/usr/bin/env python3
"""Read-only incident triage for NEAR supply GitHub Actions. No production writes."""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = os.environ.get("REPOSITORY", "")
TOKEN = os.environ.get("GH_TOKEN", "")
BASE = "https://api.github.com"
AGENT = "Talvoryn-supply-incident-triage/1.0"
MARKER = "<!-- talvoryn-supply-incident -->"

def api(path, method="GET", payload=None):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": AGENT,
               "X-GitHub-Api-Version": "2022-11-28"}
    if TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    data = json.dumps(payload).encode() if payload is not None else None
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)

def inspect_worker():
    results = []
    for path in ("/api/health", "/data/supply-daily.json"):
        url = "https://talvoryn-data.paulsimonmodus.workers.dev" + path
        record = {"path": path}
        for attempt in range(2):
            try:
                req = urllib.request.Request(url, headers={"Accept": "application/json",
                                                           "User-Agent": "Talvoryn-diagnostic/1.0"})
                with urllib.request.urlopen(req, timeout=12) as response:
                    record.update(status=response.status, content_type=response.headers.get("Content-Type"))
                break
            except urllib.error.HTTPError as error:
                record.update(status=error.code, cf_mitigated=error.headers.get("cf-mitigated"),
                              cf_ray=error.headers.get("CF-Ray"))
                if error.code not in (429, 500, 502, 503, 504):
                    break
            except Exception as error:
                record["error_type"] = type(error).__name__
            if attempt == 0:
                time.sleep(2)
        results.append(record)
    return results

def classify(step, logs, probes):
    sample = logs.lower()
    if "403" in sample and ("forbidden" in sample or "http error" in sample):
        if all(p.get("status") == 200 for p in probes):
            return ("HTTP 403: request-specific access rejection",
                    "Public Worker probes succeeded. Compare the failing request's user-agent, URL, method and authorization. Do not disable security controls.")
        return ("HTTP 403: Worker access rejected",
                "Check Cloudflare Access/WAF and the exact request path. Do not disable protections automatically.")
    if "429" in sample or "rate limit" in sample:
        return ("Rate limiting", "Respect Retry-After and retry only safe requests with bounded backoff.")
    if "401" in sample or "unauthorized" in sample or "owner_api_token" in sample:
        return ("Authentication or token configuration",
                "Review token presence, validity and endpoint permissions in GitHub/Cloudflare; never print tokens.")
    if "existing day differs" in sample or "boundary evidence conflict" in sample or "historical rows changed" in sample:
        return ("Verified data conflict", "STOP: preserve existing production data and review blockchain evidence before any write.")
    if "missing" in sample and ("secret" in sample or "fastnear_api_key" in sample):
        return ("Missing required secret", "Review repository Actions secrets; do not paste credentials into issues.")
    if "timed out" in sample or "timeout" in sample or "502" in sample or "503" in sample:
        return ("Possible transient dependency failure", "Retry safe reads with bounded backoff; do not replay a write without verifying the previous outcome.")
    if "reconstruct" in step.lower() or "validate" in step.lower():
        return ("Blockchain verification failed", "Inspect archival RPC consistency and validation artifacts; do not publish unverified data.")
    return ("Unclassified workflow failure", "Review the failed step and original run logs. No automated production repair is permitted.")

def run():
    if not REPO or not TOKEN:
        sys.exit("Repository or GitHub token missing")
    run_id = (os.environ.get("MANUAL_RUN_ID") or os.environ.get("FAILED_RUN_ID") or "").strip()
    if not run_id:
        data = api("/repos/" + REPO + "/actions/workflows/verify-supply-recent.yml/runs?status=failure&per_page=1")
        runs = data.get("workflow_runs", [])
        if not runs:
            print("No failed supply runs found; nothing to investigate")
            return
        run_id = str(runs[0]["id"])
    if not re.fullmatch(r"[0-9]{1,18}", run_id):
        sys.exit("Invalid run ID")
    workflow = api(f"/repos/{REPO}/actions/runs/{run_id}")
    if workflow.get("path", "").split("@")[0] != ".github/workflows/verify-supply-recent.yml":
        sys.exit("Refusing to triage an unrelated workflow")
    if workflow.get("conclusion") != "failure":
        print("Run is not failed; nothing to triage")
        return
    jobs = api(f"/repos/{REPO}/actions/runs/{run_id}/jobs?per_page=100").get("jobs", [])
    failures = [(job, step) for job in jobs for step in job.get("steps", [])
                if step.get("conclusion") == "failure"]
    step = failures[0][1]["name"] if failures else "Unknown failed step"
    job_id = failures[0][0]["id"] if failures else (jobs[0]["id"] if jobs else None)
    logs = ""
    if job_id:
        try:
            req = urllib.request.Request(f"{BASE}/repos/{REPO}/actions/jobs/{job_id}/logs",
                                         headers={"Authorization": "Bearer " + TOKEN, "User-Agent": AGENT})
            with urllib.request.urlopen(req, timeout=25) as response:
                logs = response.read(2_000_000).decode("utf-8", "replace")
        except Exception as error:
            print("Job logs unavailable:", type(error).__name__)
    probes = inspect_worker()
    category, recommendation = classify(step, logs, probes)
    url = workflow.get("html_url", f"https://github.com/{REPO}/actions/runs/{run_id}")
    summary = {"run_id": run_id, "run_url": url, "failed_step": step,
               "classification": category, "recommendation": recommendation,
               "worker_probes": probes,
               "observed_at": dt.datetime.now(dt.timezone.utc).isoformat()}
    Path("supply-incident-triage.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))
    title = "[Supply incident] " + category
    body = (MARKER + "\n## NEAR supply failure investigation\n\n"
            + f"**Run:** {url}\n\n**Failed step:** {step}\n\n"
            + f"**Classification:** {category}\n\n**Recommended next action:** {recommendation}\n\n"
            + "**Read-only Worker probes:**\n\n```json\n"
            + json.dumps(probes, indent=2) + "\n```\n\n"
            + "No production data, credentials or security configuration was changed by this investigation. "
            + "Original GitHub logs remain the source of truth.\n")
    issues = api(f"/repos/{REPO}/issues?state=open&per_page=100")
    existing = next((issue for issue in issues if MARKER in (issue.get("body") or "")), None)
    if existing:
        api(f"/repos/{REPO}/issues/{existing['number']}/comments", "POST", {"body": body})
        print("Updated incident issue:", existing["html_url"])
    else:
        issue = api(f"/repos/{REPO}/issues", "POST", {"title": title, "body": body})
        print("Created incident issue:", issue["html_url"])

if __name__ == "__main__":
    run()
