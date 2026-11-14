# Talvoryn — data and methodology

Python 3 standard library; no packages or API keys required for these public endpoints.

Run from the project root:

    python scripts/refresh_performance.py

Writes dist/data/performance.json and raw API snapshots. Re-publish the Site after refresh to update the hosted page. This is a manual refresh pipeline, not a scheduled live feed.

For a reproducibility check using saved raw responses:

    python scripts/refresh_performance.py --cached

The historical seed contains existing workbook v4 issuance/burns and April–September buybacks. These are retained records, not freshly independently audited by this script. Volume/fees/revenue are fetched again and compared with the seed. October onward wallet inflows are exhaustively paginated and deduplicated by receipt ID + transfer index. All positive native incoming entries count, including system/treasury.

Important limitations: latest provider values can be revised; unusually low fee days are flagged, never corrected automatically. October onward issuance and inferred burns are collected by the archival-RPC supply collector. Gross network fees remain a separate uncollected series. No broad altcoin market-cap benchmark or full historical swap-count feed is loaded. Price observations near UTC midnight estimate the value of wallet inflows, not actual execution costs. Scenario allocation is an assumption, not inferred spending. Keep missing observations as null, not zero.


Supply collection and audit (Python standard library; no API key):

    python scripts/refresh_supply.py --start 2026-10-01 --end 2026-11-11 --apply
    python scripts/validate_supply.py

The end is exclusive UTC; omitted end defaults to today’s midnight. Default performance refresh also runs this collector through the activity-data cutoff. `--cached` uses saved records. Full RPC responses, requests and retrieval times are gzip JSON in `dist/data/supply-evidence`. `supply-history.json` records every issuance event and boundary block hash; `supply-monthly.csv` provides spreadsheet-ready exact decimal figures.

At every epoch start, issuance equals the total_supply change plus balance_burnt in newly included chunks. Monthly burns equal collected issuance minus the total_supply increase between the final produced blocks before the UTC boundaries. No annual-rate estimates are used. The collector verifies consecutive epoch links and cross-checks the previous epoch’s payment against the latest validators reward map. Missing data or a reconciliation failure raises an error. Burns are inferred, not an independent sum of every transaction, and must not be labeled gross network fees.

April–September remain historical workbook records. September was independently re-collected earlier in this conversation and matched: issuance 2,676,357.2172172135 NEAR, inferred burns 25,780.91764848403 NEAR (98 events). The current proof bundle covers October onward.

### Daily Network & Supply
`python scripts/refresh_supply_daily.py` collects daily UTC block boundaries and epoch issuance from April 2026 to the latest completed UTC day. `supply-daily.json` retains exact integer issuance/burn amounts and boundary hashes. Daily totals must reconcile exactly to each collected month. `python scripts/refresh_buyback_daily.py` extends incoming wallet receipt coverage to April; then `python scripts/refresh_performance.py --cached` rebuilds activity data from saved responses. The normal performance refresh now updates daily supply as well.

The Network & Supply selector controls its own month. Summary cards use that month's totals; daily bars show issuance and stacked burns plus buybacks. The green line is Adjusted net issuance = issuance − burns − buybacks. It is an analytical offset, not a total-supply change or a CPI-adjusted measure. Missing daily inputs remain missing.

Current daily coverage is incomplete: HTTP 429 was returned by both public archival RPC and the block-header API. Daily buybacks cover April–November; exact daily issuance is available for 54/224 days; daily burns are missing. The adjusted net issuance line is wired but remains absent until daily burns are collected. Set FASTNEAR_API_KEY in the Python runtime for authenticated archival collection; optionally set NEAR_RPC_URL to another authorized archival provider. Monthly figures remain available. Do not share API keys in source files or public URLs.


Altcoin total: `python scripts/refresh_altcoin_total.py`. Santiment TOTAL2 excludes BTC and includes ETH and stablecoins. Compare percentage market-cap changes, not token returns. On 11 November 2026, the public endpoint returned no April–November 2026 observations. Saved gaps remain empty; the benchmark stays disabled until observations overlap dashboard history. Invalid or nonpositive market caps are rejected. Source: https://academy.santiment.net/metrics/marketcap/


Integrators: run `python scripts/refresh_integrators.py` from the repository root. Saves NearStats 24h/7d/30d/all windows. Rankings exclude first-party, untagged and unnamed-tag rows; cards and table share use the sum of named third-party volume. Active counts are named interfaces with positive volume. Period windows overlap; no daily sparklines or per-app fee estimates are inferred. Snapshot source: https://nearstats.org/api/integrators.json (CC BY 4.0, NearStats.org).

Research v2: `python scripts/build_research_models.py` rebuilds `dist/data/research-models.json` from saved protocol records. Requires NumPy in the analysis runtime only; the deployed site is buildless. Weekly models use expanding 16-week training windows and conditional same-week activity/BTC inputs. The JSON explicitly keeps `validatedForecast: false`. Price output is an exploratory conditional scenario, not an unconditional forecast. Buybacks are excluded from the activity coefficient when they do not improve the market-only comparison. Retained volume/revenue associations are exploratory, not causal effects. Price ranges resample centered holdout residuals in four-week blocks, with a fixed seed and no claim of calibrated probability. Issuance is held at latest complete observed monthly amount unless a hypothetical 36% ramp over 24 months after a 3-month delay is selected. Supply-only price adjustment holds total-supply valuation constant; token purchase does not reduce total supply. Offset formulas include burns and the assumed buyback budget; zero allocation/fees/capture yields an unattainable threshold unless burns already meet it. UI defaults need no typing. Advanced controls support sliders and precise entries. Mobile QA uses a temporary 390px iframe fixture removed from deployed assets after review.

## UI and data review — 14 November 2026

The whale roster is a sample of wallets verified to hold at least 100,000 native NEAR, not an exhaustive top-holder ranking. CEX receipts and deposits do not prove an offchain trade. Verified DEX swaps require successful execution and matching token receipt evidence. Ordinary wallet transfers are excluded. Evidence remains in `/api/whales` and the source ledger.

Mixed-unit chart comparisons show percentage change from the first shared positive observation; the tooltip reports actual recorded amounts. NEAR-only comparisons retain NEAR amounts. This makes different units comparable without adding them together. Missing data is never converted to zero. Cumulative mode applies to a single metric. Current selected datasets and periods remain visible as coloured chips.

Validation: all 12 existing test files passed. The saved performance daily and monthly observations reproduced unchanged. Supply audit checked 754 retained blockchain responses and October/November epoch boundaries, coverage and conservation. Research coefficients rebuilt with only floating-point rounding differences. Fixed-seed price scenarios reproduce exactly. A price-page label lookup that stopped rendering has been corrected; this was a display failure, not missing model inputs.

Coverage limitations: the saved protocol history ends on 10 November 2026. April–September issuance/burns retain historical workbook lineage; the current retained response audit covers October onward. Daily supply remains incomplete (54 of 224 issuance days; no complete daily burns). Do not treat this review as a fresh retrieval of all sources. `validatedForecast` remains false. Buyback activity does not improve the market-only price model, so its unsupported activity coefficient is not used. These are conditional scenarios, not validated predictions.

Sources and definitions remain inspectable rather than occupying every chart. DefiLlama also publishes separate data definitions and open adapter documentation: https://docs.llama.fi/analysts/data-definitions and https://docs.llama.fi/.
