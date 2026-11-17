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
| Sampled whale activity | FastNEAR transfers and finalised NEAR RPC | Every third UTC hour, two bounded wallet batches at minutes 17 and 27 | Per-wallet observation times; cohort coverage can lag |
| Integrators | https://nearstats.org/api/integrators.json | Hourly check | Provider dataEndsAt and generatedAt |
| Catalysts | https://gov.near.org, https://github.com/near/NEPs, https://near.org | Hourly discovery checks produce pending source candidates; separately reviewed items appear in the published feed | Discovery checkedAt is separate from publication/review dates; discovery is not automatic editorial approval |

The public Methodology and [production health endpoint](https://talvoryn.pages.dev/api/health) report D1-backed checks. On 16 November 2026, the hourly jobs (activity, markets, finalised supply, buybacks, integrators, catalyst discovery and X) recorded successful runs around 20:07 UTC. Whale monitoring recorded a successful run at 18:30:52 UTC, covering all **48 of 48** monitored wallets, with no pending wallet work. These timestamps document recorded successes, not a guarantee that all future runs will succeed.

`dist/data/source-status.json` records the captured timestamps from this recovery. Source cutoffs differ. Data files expose dates rather than relabelling the whole dashboard as live. Provider revisions may change historical activity; immutable stored revisions preserve the previous dataset. Source errors retain the last verified payload and update health separately.

Buyback amounts do not prove trading execution prices. The final-block supply job cannot fill missing gross issuance or burns. Some archival RPC endpoints return 429; existing evidence is retained, and incomplete daily history stays null. Wallet coverage is sampled, not a network-wide holder ranking. Integrator identity mappings belong to the provider.

## Whale monitoring — production coverage

The live [whale API](https://talvoryn.pages.dev/api/whales) exposes the selected 48-wallet sample, published exchange registry, verified qualifying movements, reporting cutoffs and daily/weekly/monthly completeness. At the recorded 16 November 2026 production check, all three windows reported complete sample coverage. This is **sample completeness under the defined registry and observation rules**, not proof of a full network-wide whale ranking or of trades at unidentified venues. The collector stores incomplete-page checkpoints and limits provider requests; source rate limits can delay subsequent runs. Unknown counterparties are preserved for separate research and are not counted as verified exchange flows.

## Historical issuance and burns — current coverage

The existing historical reconstruction is verified only through the **exclusive cutoff 2026-11-11** (observations through 2026-11-10). Historical daily burns are incomplete. The monthly archival script uses exact epoch boundaries and reconciles issued tokens against observed supply changes. The public archival endpoints previously returned HTTP 429. Do not extrapolate or assume missing values, overwrite original archival evidence, or describe a current finalised supply reading as verified gross issuance. Extension requires successful archival retrieval followed by `python3 scripts/validate_supply.py` and inspection of period coverage.

## Catalyst source monitoring

`worker/catalyst-discovery.mjs` is deployed as part of the hourly ingestion workflow. The live health endpoint recorded a **successful catalyst-discovery check at 2026-11-16T20:07:52Z**. Source checks collect and deduplicate private candidates; they do **not** automatically establish review, AI interpretation, or publication. The public [Catalysts feed](https://talvoryn.pages.dev/api/catalysts) contains separately published records. Review each item's original source and dated evidence; an upstream source failure must not be presented as a new verified story. The private candidate endpoint requires owner authentication.
