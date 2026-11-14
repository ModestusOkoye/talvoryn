# Architecture and actual deployment state

## Public frontend

Cloudflare Pages serves the existing HTML/CSS/JavaScript in `dist/`, from GitHub `main`. The dashboard consumes JSON at its existing URLs. Pages Functions forward the read-only `/data/*` and selected `/api/*` routes to a `DATA_WORKER` service binding when present. Without that binding they serve the dated snapshot files. The health endpoint explicitly reports snapshot-only mode. Public API routes reject mutations.

The original ChatGPT Site is preserved. Its legacy Worker at `worker/index.mjs` depends on the Site ingress authentication and R2; it is not the independent public Worker entrypoint.

## Independent data Worker

`worker/production.mjs` contains the new public deployment adapter and scheduler. It reuses the wallet collector and the existing data definitions. `worker/storage.mjs` uses D1: immutable dataset revisions, an atomic current pointer, source job statuses, and a lease preventing concurrent ingestion. SHA-256 content identities make repeated identical writes idempotent. Failures retain previous current pointers. Buyback pagination checkpoints are temporary recovery state; incomplete windows are never published as complete.

Each source job fails independently. Completed hourly jobs are skipped on quick retry. A successful source check is separate from freshness: health tracks both the last success and the source cutoff. Current supply observations do not substitute for missing issuance reconstruction. Existing forecast model fitting remains the Python process; the Worker does not claim to refit that statistical model hourly.

## Free-plan activation still required

No Cloudflare account credentials are available in this session. No Worker, D1 database or Cron Trigger has been provisioned by this recovery. The `wrangler.worker.example.jsonc` file is a template, with a deliberate non-ID placeholder to prevent accidental deployment to an invented resource.

With authorised Cloudflare access:

1. Create a D1 database on Workers Free; obtain its actual ID. Do not enable a paid plan.
2. Copy the example to ignored `wrangler.worker.jsonc`, insert that ID, apply `migrations/0001_ingestion.sql` remotely, and deploy with that config.
3. Set `OWNER_API_TOKEN` using Wrangler secret storage. Import the dated public datasets with `npm run seed:worker`; never import secrets or the evidence archive.
4. Bind the Worker as `DATA_WORKER` in the existing Pages project and apply the binding deployment.
5. Inspect the configured Cron Trigger `7 * * * *` (minute 7 of every UTC hour). Run a scheduled-handler test in the deployed runtime, then wait for a real scheduled execution and inspect health/logs. Configuration alone is not execution evidence.

Example commands, after creating the free database:

```sh
npx wrangler d1 create talvoryn-data
# Set the returned database ID in the ignored config before the following commands.
npx wrangler d1 migrations apply talvoryn-data --remote --config wrangler.worker.jsonc
npx wrangler secret put OWNER_API_TOKEN --config wrangler.worker.jsonc
npx wrangler deploy --config wrangler.worker.jsonc
```

Wallet collection uses a separate `17 */3 * * *` trigger so its bounded requests do not share the core hourly invocation. The code has bounded source requests, but production CPU/subrequest limits still need runtime measurement; local success does not certify Cloudflare's free limits. D1 has a 2 MB row limit; payloads above 1.9 MB are rejected without replacing the previous dataset. Historical evidence files are outside this ingestion path.

## Tests and recovery

`npm run test:core` covers chart/model logic, source validation, missing-value handling, storage reopen, duplicate writes and unauthorized mutation. `npm run test:scheduled:live` directly invokes the scheduled handler with real provider requests and a disk SQLite adapter. It proves source ingestion and local persistence, not deployment or a future Cron execution.

If a source fails, consult `/api/health` after activation. Retry the affected job on the next scheduled check; pending buyback pages resume. Historical dataset versions remain available in D1. No automatic deletion of historical versions is configured; monitor database capacity before the free storage limit is reached.
