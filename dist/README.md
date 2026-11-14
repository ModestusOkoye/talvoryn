# NEAR Lens

## Pages

Performance · Integrators · Markets · Research · Catalysts

## Data and refresh

# NEAR Lens performance refresh

Python 3 standard library; no packages or API keys required for these public endpoints.

Run from the project root:

    python scripts/refresh_performance.py

Writes dist/data/performance.json and raw API snapshots. Re-publish the Site after refresh to update the hosted page. This is a manual refresh pipeline, not a scheduled live feed.

For a reproducibility check using saved raw responses:

    python scripts/refresh_performance.py --cached

The historical seed contains existing workbook v4 issuance/burns and April–September buybacks. These are retained records, not freshly independently audited by this script. Volume/fees/revenue are fetched again and compared with the seed. October onward wallet inflows are exhaustively paginated and deduplicated by receipt ID + transfer index. All positive native incoming entries count, including system/treasury.

Important limitations: latest provider values can be revised; unusually low fee days are flagged, never corrected automatically. Current issuance after September is missing. No broad altcoin market-cap benchmark or full historical swap-count feed is loaded. Price observations near UTC midnight estimate the value of wallet inflows, not actual execution costs. Scenario allocation is an assumption, not inferred spending. Keep missing observations as null, not zero.


## Historical methodology

 
### Volume, fees & revenue
 DefiLlama daily NEAR Intents series, added into complete UTC months. Revenue measures wallet collections with internal transfers excluded. Collections can occur after fees are generated.  DefiLlama ↗  Daily coverage checked; underlying swaps not individually audited.  

 
### Buybacks
 Every successful incoming native NEAR transfer into buybacks.multisignature.near. Receipt time is assumed buyback time. Treasury transfers and refunds count; entries are deduplicated by receipt and transfer index.  FastNear transfer API ↗  Sender-level September detail is included in this preview. Individual receipt rows remain in the research workbook.  

 
### Issuance & burns
 New issuance reconstructed from historical epoch boundaries. Network burns = new issuance − change in total supply. Burns are inferred from the supply identity, rather than independently summed over every block.  NEAR archival data ↗  

 
### Estimated buyback price
 Historical price observations for each arrival's UTC date, weighted by incoming NEAR amounts. This is an arrival-date market-price estimate, not the actual price paid. The September estimate was calculated separately from workbook version 4.  Historical price source ↗  

 
### Network fees & contract rewards
 Network fees measure NEAR paid for blockchain execution. Contract rewards and fee burns are allocations of those fees and must not be added back as extra revenue. Monthly network-fee, contract-reward and fee-only-burn series are unavailable in this snapshot. No fixed 70/30 split is applied to fill the gaps. The displayed network-wide burns remain inferred from supply records.  NEAR gas and reward mechanism ↗  The net supply increase equals new issuance minus network-wide burns. Buybacks are shown separately and do not reduce total supply.  

 
### Outlook calculations
 Volume compounds at the selected monthly growth rate. Fees = volume × fee rate. Revenue = fees × capture rate. NEAR purchased = revenue × buyback allocation ÷ NEAR price. The six-month historical dataset does not establish performance across market cycles. These scenarios are user-controlled calculations; no market-regime model or statistically calibrated prediction range has been fitted.  Blank inputs and missing records must remain unavailable, not zero. Buying or holding NEAR does not itself burn tokens.  


## Integrator snapshot

Source: https://nearstats.org/api/integrators.json . Fixed 24h snapshot ending 2026-11-11 05:15 UTC. This is provider-attributed 1Click activity, not all NEAR Intents. A provider verification flag is not an independent audit. Affiliate earnings are not supplied. Integration labels do not establish a full transaction route or that a swap passed through both providers.

## Markets and Research

Price returns use matched near-midnight UTC observations. BTC is a market benchmark; ETH is a single-altcoin comparison, not a broad market index. Broad altcoin data access/licensing is unresolved. Correlations are descriptive, based on available paired monthly growth and returns; never causal. Lag=1 pairs activity growth in month t with price returns in month t+1. Market-relative return is NEAR return minus BTC return, not a regression adjustment.

Scenario calculations retain the previous model: compound volume growth; fees = volume × fee rate; revenue = fees × capture; purchases = revenue × assumed allocation / assumed price. Constant assumed issuance. Baseline uses trailing 3 complete monthly intervals for growth, trailing 3 complete months' weighted rates, the latest saved NEAR price and last observed issuance carried forward. Spending allocation is assumed, not inferred. Scenario dates are conditional, not forecasts validated across market regimes. November partial actuals are excluded from fitting. A sustained crossing requires 3 consecutive months. No network burns are subtracted from the gross-issuance comparison.

## Catalysts

The proposal feed requests open pull requests from https://api.github.com/repos/near/NEPs/pulls using the public GitHub REST API on page open, manual refresh and every five minutes while visible, with a saved snapshot fallback. It covers only the first 20 most recently updated open proposal PRs; not all news, governance or announcements. Open/merged PR status does not establish approval or mainnet activation. Published cards show created and updated timestamps distinctly. No background or streaming feed is claimed. Public API limits or connection errors leave the saved timestamp visible.

The issuance-reduction explanation is a labelled hypothetical interaction preview, authored in advance. It is NOT a real proposal or live model output. The live AI explanation service and broader news/announcement ingestion remain unconnected. Historical comparisons require individually sourced precedents before inclusion. No invented supply, annual inflation or deflation claim is used.

## Overview headline rail

The compact Overview rail reuses the public NEAR proposal feed and refreshes on open, manual request and every five minutes while visible. It is not a full news service. Summaries and plain-language explanations for the eight saved proposal versions are editorially prepared from their GitHub PR descriptions and used only when the title and updated timestamp match. New or revised items fall back to a short source excerpt and a clearly labelled unavailable live-AI explanation. No remote model is invoked. The pulsing month marker means the calendar month is ongoing, not that the economics snapshot updates continuously. Data coverage remains available on the period-selector tooltip and in the downloaded data.


## Overview charts
Intents Activity supports daily, UTC Monday-based weekly, monthly, yearly and all available history (April 2026 onward). Period totals are bars; cumulative is a line and stops across missing observations. Compare uses change from the first paired positive observation for unlike units; buybacks versus issuance uses actual NEAR. Date handles filter the chart. PNG export and share links preserve chart selections; sharing to X opens a composer without posting.

Network & Supply reports minted minus burned as net issuance, without subtracting buybacks. Supply records currently end September 2026; network fees are unavailable. Revenue Capture uses fees/volume and revenue/fees calculated from summed amounts. Market Performance places NEAR price alongside activity, with optional subsequent-period prices and BTC/ETH returns. Partial periods are marked, and incomplete-period activity changes are suppressed. Correlation does not establish causation. Broad altcoin total is unavailable. These controls use the existing saved history; they do not add forecasts or claim a live economic feed.

Chart appearance update: compact Compare chevron, full-width SVG rendering, bounded smooth curves through recorded points, line/area range navigator, and dates/partial status in hover details instead of a visible footer.

Cumulative toggle now overlays the running-total line on period bars. Period totals use the left axis; cumulative totals use the labeled right axis, both with zero baselines. Hover and image export include both series.

Fee Rate and Revenue Capture are now simultaneous monthly line charts directly below Intents Activity and before Network & Supply. They use the full available history through the latest record regardless of the top reporting-month selection; headline values are the latest monthly ratios of sums. Small hover/focus icons explain each ratio. Mobile layouts stack the two cards.

Supply chart: one issuance bar beside a stacked burn/buyback-inflow bar each month, plus a net-issuance line on the same NEAR axis. The buyback segment assumes retention under the user definition; it is not a verified change in retained balances. Hover reports (burns + inflows)/gross issuance as issuance offset. Missing issuance/burn months remain gaps, not zeros. Source data unchanged.

Supply redesign: removed net-issuance line and native SVG title tooltips. Supply chart and summary totals share all months with issuance, burns and buybacks available (currently April–September 2026), independent of the top month selector. Remaining issuance = issuance minus burns minus wallet inflows, an analytical offset measure, not change in total supply. Network fees and newer supply collection remain incomplete; no source records were invented or backfilled. Simplified supply hover to month and four values.

Supply update: October and November 1–10 issuance/burns now come from archival-RPC epoch-boundary records. Evidence, CSV export, validation report and refresh scripts are included. Burns are inferred through supply conservation; gross network fees remain uncollected. No scheduled live-refresh service is claimed.

Network & Supply: choose a month for monthly summary figures and daily bars. Adjusted net issuance is a line: issuance minus burns minus buybacks. Daily source data: data/supply-daily.json, supported by saved RPC evidence. The month-in-progress dot follows the selected month.

Daily supply backfill is incomplete (public API HTTP 429). The chart shows only verified daily values, flags missing daily burns, and does not fabricate an adjusted net issuance line. Monthly totals remain available.

Network & Supply table preview: month selector, daily rows, sticky month totals, four metric columns. Removed chart and duplicate summary cards. Adjusted net issuance is calculated only when issuance, burns and buybacks are all finite; missing inputs display an em dash. Monthly totals use independently available monthly records, not sums of incomplete daily rows.

Monthly supply trend table: one row per month; percent changes under amounts and percentage-point changes under Issuance offset. Partial-month comparisons use strictly complete same-elapsed-day records from the prior month; no full-month comparison or scaling. Missing inputs suppress derived metrics and changes. Click a month to expand daily details.

Removed daily expansion from the monthly supply table because daily issuance/burn coverage remains incomplete. The main table retains monthly records, changes and issuance offset; source data and missing-value rules are unchanged.

Supply table polish: removed amount/missing-value labels and their gap, removed monthly-change hover popups and burn/buyback info icons. Remaining information tooltips render outside the table scroll container and stay within the viewport. Adjusted net issuance tooltip: Issuance − (burned tokens + buybacks).
