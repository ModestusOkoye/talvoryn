# Talvoryn methodology

Talvoryn compares NEAR Intents activity, earnings, buyback-wallet inflows and token supply. Forecast is a conditional scenario tool, not a price promise or a causal valuation model.

## Observation time and missing data

UTC is used throughout. The published files carry source cutoffs and retrieval times. Retrieval time is not the time of the underlying observation. An hourly check does not turn a daily observation into an intraday figure. Null means unavailable; it never means zero. Historical supply cutoffs are retained even when activity extends further.

Current production uses dated, verified snapshots. The independent Worker, D1 schema and hourly trigger template are implemented and tested locally; account-side deployment and binding are not yet activated. No future Cron execution is claimed.

## Activity and earnings

Daily volume, gross fees and revenue come from DefiLlama's NEAR Intents adapter. Values must be finite, nonnegative and unique per UTC date. The current UTC day is excluded from complete-day history. Monthly amounts require complete daily coverage for the metric; missing days yield null. A partial month compares with the same number of elapsed days in the preceding month.

- Fee rate = sum(fees) / sum(volume).
- Revenue capture = sum(revenue) / sum(fees).
- Revenue records may lag fee records; these are provider-defined series, not a per-trade accounting audit.

## Buybacks

Every successful positive native NEAR transfer into `buybacks.multisignature.near` counts under the owner's definition, including treasury transfers and refunds. Arrival time is the buyback time. Transfers are deduplicated by receipt ID and transfer index. Pagination must finish before an interval is marked complete. Amounts are accumulated in yoctoNEAR before conversion.

Estimated USD value = NEAR received × the arrival-day market observation. It is not proven execution expenditure. The refresh revisits an overlapping day and replaces verified daily totals; it does not append a second total for that day.

## Supply

Existing issuance uses exact epoch-boundary block supply changes plus burns in newly included chunks. Period burns = gross issuance − observed total-supply increase between verified UTC boundary blocks. Adjusted net issuance = issuance − burns − buybacks. Issuance offset = (burns + buybacks) / issuance.

Recovered monthly supply covers October and the first ten days of November 2026; earlier workbook history is identified in the records. Current November totals are not filled from those partial records. Daily supply coverage remains incomplete. A newly fetched finalised block proves a supply observation, not gross issuance or burns over a missing interval. The original archival evidence remains in the original Site source; it was not rebuilt or uploaded in this recovery.

## Wallet intelligence

The existing collector follows a bounded sample of accounts checked for at least 100,000 NEAR. It excludes recognised custodians, treasuries and contracts. Known exchange legs and proven DEX receipts are classified; ordinary transfers are excluded. Exchange deposits or withdrawals do not prove an off-chain purchase or sale. Receipt identities prevent duplication. Incomplete wallet histories cannot produce a complete D/W/M score. Each wallet retains its own observation time, and the cohort cutoff may be earlier than the latest refresh attempt.

## Forecast

The existing `research-model.js` formulas, controls, comparisons and slider logic remain unchanged. Monthly revenue = volume × fee rate × capture rate. Modelled NEAR purchases = revenue × buyback allocation / NEAR price. An offset crossing requires three consecutive projected months at or above the target. Missing supply is not replaced with an assumed annual inflation rate.

The existing Python fitter uses complete non-overlapping weekly log returns, ridge regression and expanding chronological holdouts. Activity/market inputs are conditional assumptions. The price scenario uses the fitted activity term only under the existing validation rule; otherwise it uses the market-only model. Resampled residual ranges are historical variation, not calibrated confidence intervals. Refitting uses the existing script without changing the model.

## Integrators

NearStats supplies rolling 24-hour, 7-day, 30-day and all-time windows. Named third-party interfaces are counted once; first-party, unknown and unlabelled tags are excluded from rankings. Routing layers are not added again. Shares use the same third-party denominator. Rolling windows overlap; they are not additive daily history. Attribution: NearStats.org, CC BY 4.0.

## Reproduction

Run `npm run test:core`. Refresh activity with `python3 scripts/refresh_performance.py --skip-supply`, refresh integrators with `python3 scripts/refresh_integrators.py`, then run `python3 scripts/build_research_models.py`. The skip flag preserves verified supply and avoids rebuilding evidence. Run `npm run test:scheduled:live` explicitly for a real-provider scheduled-handler test using a local disk-backed SQLite adapter. It is not a Cloudflare Cron run. See DATA_SOURCES and ARCHITECTURE for endpoints and activation prerequisites.
