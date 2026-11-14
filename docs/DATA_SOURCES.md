# Data sources and refresh policy

| Dataset | Original source | Frequency in the Worker | Cutoff semantics |
| --- | --- | --- | --- |
| Intents volume | https://api.llama.fi/summary/dexs/near-intents | Hourly check | Complete UTC daily observations |
| Gross fees | https://api.llama.fi/summary/fees/near-intents?dataType=dailyFees | Hourly check | Complete UTC daily observations |
| Revenue | https://api.llama.fi/summary/fees/near-intents?dataType=dailyRevenue | Hourly check | Complete UTC daily observations |
| NEAR/BTC/ETH prices | https://coins.llama.fi/chart/coingecko:near | Hourly check | Near-midnight daily observations; BTC and ETH use their respective IDs |
| Buyback receipts | https://transfers.main.fastnear.com/v0/transfers | Hourly bounded pagination | Arrival timestamp; incomplete ranges remain pending |
| Finalised supply observation | https://rpc.mainnet.near.org | Hourly check | Finalised block timestamp, hash and exact total supply |
| Historical issuance/burns | https://archival-rpc.mainnet.fastnear.com and https://mainnet.neardata.xyz | Explicit archival script; not currently automated | Verified epoch and UTC boundaries only |
| Sampled whale activity | FastNEAR transfers and finalised NEAR RPC | Every third UTC hour, separate minute-17 trigger | Per-wallet observation times; cohort coverage can lag |
| Integrators | https://nearstats.org/api/integrators.json | Hourly check | Provider dataEndsAt and generatedAt |
| Catalysts | https://gov.near.org, https://github.com/near/NEPs, https://near.org | Existing dated reviewed records only in this deployment | Story dates and checkedAt; no claim of a live editorial feed |

The public Methodology Data Freshness table has received real D1-backed status records for activity, prices, finalised supply, buybacks and integrators. These confirm successful checks at the recorded times, not continuous future Cron execution. The separate whale job still lacks a reported successful refresh.

`dist/data/source-status.json` records the captured timestamps from this recovery. Source cutoffs differ. Data files expose dates rather than relabelling the whole dashboard as live. Provider revisions may change historical activity; immutable stored revisions preserve the previous dataset. Source errors retain the last verified payload and update health separately.

Buyback amounts do not prove trading execution prices. The final-block supply job cannot fill missing gross issuance or burns. Some archival RPC endpoints return 429; existing evidence is retained, and incomplete daily history stays null. Wallet coverage is sampled, not a network-wide holder ranking. Integrator identity mappings belong to the provider.

## Deferred follow-up

- Investigate the whale activity refresh: the public Data Freshness table currently reports no successful-check timestamp or observation cutoff for the three-hour whale job. Check Cron execution, job health, verified roster, rate limits and per-wallet coverage before changing the published readings. Do not substitute saved snapshot dates for successful live job status.

## Historical issuance and burns — current coverage

The existing historical reconstruction is verified only through the **exclusive cutoff 2026-11-11** (observations through 2026-11-10). Historical daily burns are incomplete. The monthly archival script uses exact epoch boundaries and reconciles issued tokens against observed supply changes. The public archival endpoints previously returned HTTP 429. Do not extrapolate or assume missing values, overwrite original archival evidence, or describe a current finalised supply reading as verified gross issuance. Extension requires successful archival retrieval followed by `python3 scripts/validate_supply.py` and inspection of period coverage.

## Catalyst source monitoring

The current production Worker source now includes `worker/catalyst-discovery.mjs`, which checks the latest NEAR governance topics and NEP pull requests during its hourly ingestion job and stores deduplicated findings as **private candidates** in D1. It does not automatically publish Catalyst summaries or update the editorial feed. An owner-authenticated GET to `/api/admin/catalyst-candidates` can inspect the pending findings after the Worker version is deployed. A source-check failure is recorded rather than treated as fresh editorial coverage. Actual production execution must be confirmed through `/api/health` after deployment; GitHub commits alone do not activate the deployed Worker.
