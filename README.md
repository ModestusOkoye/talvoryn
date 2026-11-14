# Talvoryn

Talvoryn is a NEAR research dashboard for understanding Intents activity, fees, revenue, issuance, burns and exchange-related activity among a sample of large native NEAR accounts. Forecast provides conditional scenarios, not price promises.

**Migration status:** standalone staging preparation. Production cutover, hourly publication, source freshness and cross-device acceptance are not yet verified. The original ChatGPT Sites application remains the rollback reference. See [the phase checklist](docs/IMPLEMENTATION_STATUS.md).

## What you can explore

- **Overview:** activity charts, fee rate, revenue capture, network/supply measures, market comparisons, Catalysts and Whale Accumulation.
- **Integrators:** named third-party activity, window filters, Top 5 share and app detail.
- **Forecast:** editable issuance-offset, revenue and conditional price scenarios, including comparisons.
- **About:** compact introduction and access to public methodology.

Telegram and weekly reports are planned, not connected subscriptions. No wallet transaction is needed to use the research dashboard.

## Quick verification

Requires Python 3.10+ and Node.js 22+. Existing tests use Node's built-in runner. Offline verification needs no API key.

```sh
node --test tests/*.cjs tests/*.mjs
python3 scripts/snapshot.py --verify
python3 scripts/validate_supply.py
python3 scripts/build_standalone.py
node --check build/worker.mjs
```

Expected results: tests pass; retained dataset checksums and daily/monthly totals agree; saved supply proofs reconcile for their stated months; the standalone build contains Overview, Integrators and Forecast. `validate_supply.py` writes a fresh validation report, not fresh chain observations. It explicitly reports incomplete daily supply coverage.

To regenerate the publication bundle after a legitimate data update:

```sh
python3 scripts/snapshot.py
python3 scripts/build_standalone.py
```

These commands do not retrieve new observations. They must never be described as a live-data refresh. Fresh ingestion commands, evidence and limits are documented in [DATA_SOURCES](docs/DATA_SOURCES.md).

## Architecture and repository map

The existing frontend stays buildless. A small Cloudflare Worker serves read-only data and authenticated owner/scheduler operations. Private R2 stores runtime state and immutable publication history. Browser assets are deployed separately from the Worker bundle.

| Component | Location |
| --- | --- |
| Frontend pages, styles and charts | `dist/` (historical name retained during migration) |
| Data ingestion and evidence retrieval | `scripts/refresh_*.py`, `worker/collectors.mjs`, `worker/whales.mjs` |
| Pure calculations | `dist/research-model.js`, `dist/chart-curves.js`, `worker/exchange-flows.mjs` |
| Runtime/API and authorisation | `worker/index.mjs`, `worker/standalone.mjs` |
| Configuration | `wrangler.json`, `config/`, `.env.example` |
| Storage contract and retained datasets | `data/README.md`, `dist/data/`, `worker/*seed.json` |
| Tests and QA | `tests/`, `qa/` |
| Research/methodology and operational documents | `docs/` |
| Generated deployment files | `build/` (ignored) |

This intentionally preserves proven paths. Moving every file or adding a SQL database merely for appearance is not required. See [ARCHITECTURE](docs/ARCHITECTURE.md).

## Data honesty

Activity and integrator observation cutoffs are recorded separately in the snapshot manifest. Daily issuance is incomplete, daily burns are unavailable for much of the saved window, and older supply history has different evidence strength from retained later RPC proofs. These are limitations, not zeroes.

The 48-wallet cohort is an activity-discovered sample, not the global top 48 holders. Only known CEX transfers and evidence-backed DEX swaps qualify. Buyback figures follow the owner's rule: successful positive native NEAR arrivals into the designated buyback wallet; their estimated USD value is not actual purchase expenditure. Buying/holding NEAR does not destroy total supply.

Read [METHODOLOGY](docs/METHODOLOGY.md) for definitions, exclusions, calculations, windows and limitations. A checksum proves unchanged bytes, not that a financial claim is correct. Internal reconciliation and independent chain checks are identified separately.

## Local preview and deployment

Build with the commands above. The generated `build/public` is the browser asset directory; `build/worker.mjs` is the standalone Worker. A static file server can preview layout but cannot validate runtime APIs. Full local Worker testing requires Cloudflare Wrangler from its official npm package and local R2 emulation.

`wrangler.json` is a staging configuration, not proof of a configured Cloudflare account. Before deployment:

1. Confirm the free Workers plan and an authorised storage setup. Never accept paid billing automatically.
2. Create/bind the staging bucket named in configuration, then supply secrets through Cloudflare's secret mechanism. Never place values in tracked files.
3. Set `OWNER_API_TOKEN` and `JOB_TOKEN` to separate cryptographically random values of at least 32 characters. `CATALYST_KEY` must preserve the original encryption key when restoring encrypted credentials, or credentials must be securely re-entered. Do not copy keys through documentation.
4. Keep `TRUST_SITES_AUTH=false` on independent hosting. Client-supplied identity headers are not trusted.
5. Run `wrangler deploy` only after local checks, then verify all pages, API permissions, storage, observations and a real scheduled publication before production cutover.

`python3 scripts/publish_snapshot.py` uses `TALVORYN_URL` and `JOB_TOKEN` from the environment to upload a validated bundle and verify exact readback. It does not create storage, change billing or deploy a frontend. No public production URL is claimed until observed.

## Reproducibility and provenance

`dist/data/snapshot-manifest.json` records source cutoffs, retrieval metadata and SHA-256 checksums. `scripts/snapshot.py --verify` checks the committed dataset files and aggregation rules offline. Full RPC block evidence is retained in the checksummed `data/supply-evidence.tar.gz` archive, outside the public asset build; validation reads the archive without extracting it. Source observations, ingestion, verification and publication times have different meanings.

This project was developed with AI assistance and originates from the existing ChatGPT Sites project. The preserved baseline is commit `a5ef06496841b3f0084d8e2f902c6fe9a729c343`; migration changes follow it on `migration/cloudflare`. Historical work must not be presented as newly written in the migration. Root and older documents are being reconciled with the approved owner decisions.

The near-insight repository was studied for documentation practices only. Its code, design, research conclusions and text are not incorporated. Talvoryn's existing browser code, Python standard library collection and Node test runner are retained. NumPy is required only for the existing model-fitting script; install its pinned dependency with `pip install -r requirements-models.txt` before running ingestion.

A public-source licence decision is pending owner approval. Do not infer an MIT grant from the example repository. Third-party data retains provider terms and attribution requirements.
