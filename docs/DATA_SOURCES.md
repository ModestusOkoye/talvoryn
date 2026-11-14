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

These are implemented policies in the independent Worker, not a claim that Cloudflare has activated them. Production remains snapshot-backed until Worker deployment, a free D1 binding and the Pages service binding are configured.

`dist/data/source-status.json` records the captured timestamps from this recovery. Source cutoffs differ. Data files expose dates rather than relabelling the whole dashboard as live. Provider revisions may change historical activity; immutable stored revisions preserve the previous dataset. Source errors retain the last verified payload and update health separately.

Buyback amounts do not prove trading execution prices. The final-block supply job cannot fill missing gross issuance or burns. Some archival RPC endpoints return 429; existing evidence is retained, and incomplete daily history stays null. Wallet coverage is sampled, not a network-wide holder ranking. Integrator identity mappings belong to the provider.
