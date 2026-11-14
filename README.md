# Talvoryn

[Public dashboard](https://talvoryn.pages.dev) · [Methodology](https://talvoryn.pages.dev/methodology.html)

Talvoryn makes NEAR Intents activity, fees, revenue, buyback-wallet inflows and token supply easier to compare. Overview contains historical charts and period selectors; Forecast supports issuance-offset, price and revenue scenarios with editable assumptions and comparison. Integrators and sampled whale analytics provide additional context. Telegram and weekly newsletter controls are clearly marked **Coming soon** and do not collect information.

## Current state

The frontend is deployed on Cloudflare Pages. The production recovery restores dated historical files and refreshes supported observations from their original sources. It does not label saved records as a working live service. Some supply and wallet coverage ends earlier than activity.

An independent Worker with D1 persistence and an hourly Cron configuration template is implemented. A direct scheduled-handler test ingested actual provider data and verified persistence after reopening the local database. **Cloudflare Worker/D1/service-binding activation is blocked by missing deployment access. The hourly Cron Trigger has not been activated or proven to run in production.**

See [source timestamps](dist/data/source-status.json) and [deployment architecture](docs/ARCHITECTURE.md). Current observations are not evidence of complete historical issuance/burns coverage. The original ChatGPT Site and its evidence archive remain intact.

## Run and verify

Requires Node.js 22+ for the application tests, Node.js 24+ for the local SQLite integration test, and Python 3.10+ for refresh scripts. Frontend code has no npm runtime dependencies. Model fitting requires NumPy from `requirements-models.txt`.

```sh
npm run dev
# Open http://localhost:8080
npm run test:core
python3 -m pip install -r requirements-models.txt
python3 scripts/refresh_performance.py --skip-supply
python3 scripts/refresh_integrators.py
python3 scripts/build_research_models.py
npm run test:scheduled:live
```

The live integration test explicitly contacts public providers and writes only ignored local `.qa/` state. It does not create Cloudflare resources or incur Cloudflare charges. The skip-supply refresh preserves existing supply history instead of rebuilding archival evidence.

## Deployment

Pages uses branch `main`, output `dist`, and build command `exit 0`; it also bundles the read-only Pages Functions. Existing chart and Forecast calculations are preserved. Follow [ARCHITECTURE](docs/ARCHITECTURE.md) for the free D1/Worker activation steps, actual binding names, trigger and verification. Credentials belong in secret storage, never in this repository.

## Documentation

- [Methodology](docs/METHODOLOGY.md): definitions, formulas, exclusions and reproduction.
- [Data sources](docs/DATA_SOURCES.md): original URLs, source timing and limitations.
- [Architecture](docs/ARCHITECTURE.md): actual deployment state, storage, retries and activation.

For research and education. Forecasts describe conditional scenarios; they are not investment promises.
