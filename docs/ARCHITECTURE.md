# Architecture and actual deployment state

## Public frontend

Cloudflare Pages serves the existing HTML/CSS/JavaScript in `dist/`, from GitHub `main`. The dashboard consumes JSON at its existing URLs. Pages Functions forward the read-only `/data/*` and selected `/api/*` routes to a `DATA_WORKER` service binding when present. Without that binding they serve the dated snapshot files. The health endpoint explicitly reports snapshot-only mode. Public API routes reject mutations.

The original ChatGPT Site is preserved. Its legacy Worker at `worker/index.mjs` depends on the Site ingress authentication and R2; it is not the independent public Worker entrypoint.

## Independent data Worker

`worker/production.mjs` contains the new public deployment adapter and scheduler. It reuses the wallet collector and the existing data definitions. `worker/storage.mjs` uses D1: immutable dataset revisions, an atomic current pointer, source job statuses, and a lease preventing concurrent ingestion. SHA-256 content identities make repeated identical writes idempotent. Failures retain previous current pointers. Buyback pagination checkpoints are temporary recovery state; incomplete windows are never published as complete.

Each source job fails independently. Completed hourly jobs are skipped on quick retry. A successful source check is separate from freshness: health tracks both the last success and the source cutoff. Current supply observations do not substitute for missing issuance reconstruction. Existing forecast model fitting remains the Python process; the Worker does not claim to refit that statistical model hourly.

## Verified production deployment (16 November 2026)

The existing `talvoryn-data` Cloudflare Worker, its D1 database and scheduled ingestion are already active. The public [health endpoint](https://talvoryn.pages.dev/api/health) reports `storage: "D1"` and records successful source checks. **Do not create a replacement Worker or D1 database to follow these notes.**

Production evidence checked on 16 November 2026 (timestamps in UTC):

| Job | Last recorded success | Schedule / observation |
| --- | --- | --- |
| Intents activity, markets, supply-head, buybacks and integrators | 20:07 UTC hour | `7 * * * *` hourly |
| Catalyst discovery and X source collection | 20:07 UTC hour | `7 * * * *`; discovery checks are not automatic editorial publication |
| Whale monitoring | 18:30:52 UTC | `27 */3 * * *` run; 48 of 48 sampled wallets covered, no pending wallet work at the recorded check |

The Worker scheduler also recognises `17 */3 * * *` for the other half of the wallet batch, as implemented in [production.mjs](../worker/production.mjs). Each three-hour cycle uses bounded batches instead of requiring a full historical rescan. The latest success status verifies **this completed run**, not uninterrupted future operation.

Whale coverage is a selected 48-wallet cohort, **not** a reconstructed network-wide holder ranking. Its 24-hour, 7-day and 30-day calculations count only defined exchange-related movements. Known published CEX withdrawals/deposits are identified as transfers, not inferred trades; DEX trades require successful matching evidence. Source limits or partial retrievals are recorded rather than silently treated as complete coverage.

Current finalised supply observations refresh hourly, but **historical daily issuance and burns are a separate archival reconstruction** and remain incomplete. Model fitting is also a separate process; the hourly Worker does not retrain the Forecast model.

## Updating or recovering the existing Worker

Use the existing Cloudflare Worker and D1 binding, not the example configuration's placeholder database ID. Before connecting a Git-based deployment or running Wrangler, confirm the **actual deployed** database ID, binding name, runtime configuration, two whale cron definitions, hourly cron, existing secrets and deployment entrypoint. The example `wrangler.worker.example.jsonc` is a template only and should not be deployed unchanged.

For an authorised code update, deploy `worker/production.mjs` to the existing Worker while preserving D1 and its data. Do not re-run database creation, seed or migrations merely to deploy a code change; apply a migration only when a reviewed schema change requires one. Never put tokens in Git.

After deployment, read `/api/health`, `/api/whales`, and the relevant Catalyst endpoints. Check recorded execution timestamps, observation cutoffs, cohort counts, pending work and errors. A successful build or configured cron alone is not proof that a production ingestion run completed. The free-tier CPU and subrequest budgets remain relevant to future workloads, even though the above checks succeeded.

## Tests and recovery

`npm run test:core` covers chart/model logic, source validation, missing-value handling, storage reopen, duplicate writes and unauthorized mutation. `npm run test:scheduled:live` directly invokes the scheduled handler with real provider requests and a disk SQLite adapter. It proves source ingestion and local persistence, not deployment or a future Cron execution.

If a source fails, consult `/api/health` after activation. Retry the affected job on the next scheduled check; pending buyback pages resume. Historical dataset versions remain available in D1. No automatic deletion of historical versions is configured; monitor database capacity before the free storage limit is reached.
