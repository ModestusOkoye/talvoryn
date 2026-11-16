# Talvoryn

**One-stop intelligence and research dashboard for NEAR. Built for NEAR Hackathon 2026.**

[Live Platform](https://talvoryn.pages.dev) · [Methodology](https://talvoryn.pages.dev/methodology.html) · [Catalysts](https://talvoryn.pages.dev/catalysts.html) · [Research Thesis](research-thesis.md)

![Talvoryn Overview](docs/assets/talvoryn-overview.png)

## Understanding NEAR beyond its price chart

NEAR is an evolving blockchain ecosystem. Following its trajectory means examining **market behaviour (TA)**, **developments that might change its fundamentals (FA)** and **what the blockchain actually records (on-chain analysis)**.

**Talvoryn connects these three perspectives in one research environment.**

NEAR Intents is a central part of that work—not the entire research thesis. Its swaps, fees, revenue, integrations and buyback-wallet activity provide measurable signs of traction. We compare those signals with NEAR's supply, market performance, wallet activity and wider ecosystem catalysts to see whether the evidence supports or challenges our expectations.

The aim is to follow a changing picture of NEAR, form research questions and **revise our conclusions when new evidence demands it**.

## Explore Talvoryn

| Feature | What you can explore |
| --- | --- |
| [**Overview**](https://talvoryn.pages.dev/performance.html) | Market performance, Intents volume, fees, revenue, buyback-wallet inflows and token economics |
| [**Catalysts**](https://talvoryn.pages.dev/catalysts.html) | Governance decisions, protocol upgrades, product launches, partnerships, adoption and other developments relevant to NEAR's fundamentals |
| [**Forecast**](https://talvoryn.pages.dev/research.html) | Issuance-offset, revenue and exploratory price scenarios with adjustable assumptions and comparison |
| [**Integrators**](https://talvoryn.pages.dev/integrators.html) | Activity and attributed market share across eligible third-party applications using NEAR Intents |
| **Wallet intelligence** | Verified exchange-related flows across a monitored sample of large NEAR wallets, surfaced in Overview |
| [**Methodology**](https://talvoryn.pages.dev/methodology.html) | Data sources, formulas, coverage, verification and reproducibility |
| [**Research Thesis**](research-thesis.md) | AI-readable research brief covering the hypothesis, evidence, counterarguments and what to verify next |

## Three pillars of Talvoryn

### 1. Technical analysis (TA) — What is the market doing?

We compare NEAR's market performance with broader conditions, including BTC and ETH. Price trends, momentum and relative performance provide context for the market's reaction to developments.

The research combines market history and relative-performance comparisons, with scope to extend technical indicators over time.

### 2. Fundamental analysis (FA) — What could change NEAR's outlook?

**Catalysts sit at the centre of our fundamental research.** We follow governance and tokenomics proposals, protocol upgrades, ecosystem launches, integrations, partnerships, adoption and competitive developments.

A headline alone is not a conclusion. For each meaningful catalyst, the research asks:

- **What happened?** Is it a proposal, announcement, implementation or verified result?
- **Why does it matter?** Which part of NEAR's adoption, utility or economics might it affect?
- **What should we watch?** What observable evidence could confirm—or challenge—the expected impact?

NEAR Intents contributes fundamental *traction evidence*, but the analysis of NEAR extends beyond Intents.

### 3. On-chain analysis — What does the blockchain show?

Blockchain evidence helps test the fundamental story. Talvoryn examines finalised supply observations, reconstructed issuance and burns, inbound NEAR transfers to the buyback wallet and qualifying exchange-related whale flows.

**Buyback wallet inflows and token supply belong here as measured on-chain evidence.** Their *economic interpretation* also informs fundamental analysis, but they are not the same as governance or product catalysts.

An exchange deposit does not prove a sale; a wallet withdrawal does not prove a purchase. We separate observable transfers from unsupported explanations.

### How the pillars work together

```mermaid
flowchart TD
    TA["Technical analysis<br/>Price and relative market behaviour"]
    FA["Fundamental analysis<br/>Catalysts, governance and adoption"]
    OC["On-chain analysis<br/>Supply, wallet flows and activity"]
    TA --> R["Research questions and thesis"]
    FA --> R
    OC --> R
    R --> E["Define evidence that supports or challenges the thesis"]
    E --> M["Monitor new observations"]
    M --> V["Maintain, revise or reject the thesis"]
    V --> M
```

These are **complementary perspectives**, not three interchangeable datasets. A catalyst may suggest a possible change; on-chain and economic observations can help assess whether it materialises; market data shows how the price has behaved.

## How Talvoryn works

Collection and research modelling are separate processes. Different sources can cover different periods, so each measurement keeps its own observation cutoff and recorded check time.

```mermaid
flowchart TD
    A["DefiLlama<br/>Intents activity and market prices"] --> D["Validate source values and coverage"]
    B["NEAR RPC and FastNEAR<br/>Supply and transfers"] --> D
    C["NearStats<br/>Integrator attribution"] --> D
    D --> DB["Cloudflare Worker + D1<br/>Versioned datasets and job status"]
    DB --> SITE["Talvoryn<br/>Overview, Integrators and source freshness"]
    H["Saved historical research inputs"] --> MODEL["Python statistical model build"]
    MODEL --> F["Saved model and model-build timestamp"]
    F --> SITE
    OFF["Official proposals and source updates"] --> DISC["Catalyst discovery / review"]
    DISC -. "Reviewed findings only" .-> SITE
```

The statistical Forecast model is **not automatically retrained with each hourly data refresh**. Source monitoring can identify candidate catalysts; a candidate is not automatically an approved interpretation or a published story.

### Whale intelligence — inspect the evidence

Talvoryn monitors **48 identified NEAR wallets** and measures their verified exchange-related flows over rolling **24-hour, 7-day and 30-day** windows. Explore **Whale Accumulation** on the [Overview](https://talvoryn.pages.dev/performance.html); the [public whale dataset](https://talvoryn.pages.dev/api/whales) exposes the underlying wallet cohort, exchange registry, transaction receipts, classification and reporting windows.

The published exchange registry currently lists **26 CEX address entries** (Binance and KuCoin) and **two DEX contracts** (Rhea / Ref AMM and DCL). CEX movements are classified as exchange deposits or withdrawals, not automatically as sales or purchases. DEX buys and sells require a successful transaction and matching swap/transfer evidence. Unverified counterparties do not become trades.

**Try it yourself** — run this in any browser's developer console on Talvoryn, or in Node.js 22+:

```js
const d = await fetch('https://talvoryn.pages.dev/api/whales').then(r => {
  if (!r.ok) throw Error('Whale dataset unavailable: ' + r.status);
  return r.json();
});
console.log('Wallets:', d.roster.length, 'CEX addresses:', d.registry.cex.length,
  'DEX contracts:', d.registry.dex.length);
console.table(['D', 'W', 'M'].map(period => {
  const p = d.periods[period];
  return {
    period, fromUTC: p.from, throughUTC: p.through,
    complete: p.complete, inflowsNEAR: p.incoming,
    outflowsNEAR: p.outgoing, netNEAR: p.net,
    verifiedEvents: p.events.length
  };
}));
console.table(d.periods.M.events.slice(0, 10).map(e => ({
  timeUTC: e.timestamp, kind: e.kind, venue: e.venue,
  amountNEAR: e.amount, transaction: e.transaction, receipt: e.receipt
})));
```

To reproduce an event, inspect its transaction and receipt on a NEAR explorer and compare the wallet, exchange counterparty, timestamp, token amount and event classification. The [Methodology](https://talvoryn.pages.dev/methodology.html) explains the rules and timestamp cutoffs. The 48 wallets are a **monitored sample**, not a claimed ranking of every NEAR holder.

**Check collection status:** [Public source health](https://talvoryn.pages.dev/api/health) reports the dataset's last successful check and data-through timestamp. The wallet collection runs in two batches every three hours.

### Data schedules and transparency

| Dataset | Collection/check schedule |
| --- | --- |
| Intents volume, fees and revenue | Hourly |
| NEAR, BTC and ETH daily prices | Hourly |
| Current finalised supply observation | Hourly |
| Buyback-wallet transfers | Hourly |
| Integrators | Hourly |
| Sampled whale activity | Every 3 hours |
| Historical issuance and burns | Separate archival reconstruction |
| Catalyst source discovery | Hourly |

A successful check is not the same as a new observation. The website's [Data Freshness table](https://talvoryn.pages.dev/methodology.html#freshnessTitle) distinguishes **Data through (UTC)** from **Last successful check (UTC)**.

## Research Thesis

[**Read research-thesis.md**](research-thesis.md)

The research thesis is a standalone Markdown brief designed for both human review and AI-assisted analysis. It outlines what Talvoryn is investigating, which measurements support or challenge the hypothesis, what remains uncertain, and the evidence needed to update the view.

**Download or open the file in Claude, ChatGPT, Codex or another AI assistant** to interrogate the thesis, look for counterarguments, compare new evidence, or prepare a dated research update. Include fresh datasets or allow source retrieval for a current assessment; the thesis file alone is not a live data feed.

## Research you can verify

A useful research figure should be traceable. Talvoryn documents **where it came from, the period it covers, its calculation and how to verify the underlying evidence**.

- [Technical Methodology](docs/METHODOLOGY.md) — formulas, research flows, verification rules, worked examples and reproduction steps
- [Data Sources](docs/DATA_SOURCES.md) — original providers, cutoff definitions and collection schedules
- [Architecture](docs/ARCHITECTURE.md) — Cloudflare infrastructure, persisted datasets, deployment and recovery checks

## Run locally

Requirements: **Node.js 22+** for core tests, **Node.js 24+** for the disk-backed SQLite integration test, **Python 3.10+**, and **NumPy** for statistical model fitting.

```bash
git clone https://github.com/ModestusOkoye/talvoryn.git
cd talvoryn

npm run dev
# Open http://localhost:8080
```

Run core validation and refresh supported sources:

```bash
npm run test:core
python3 -m pip install -r requirements-models.txt
python3 scripts/refresh_performance.py --skip-supply
python3 scripts/refresh_integrators.py
python3 scripts/build_research_models.py
```

The `--skip-supply` flag avoids rerunning expensive archival reconstruction and preserves verified supply evidence. Rebuilding the statistical model is a **separate explicit command**.

Optional real-provider local scheduled-handler test:

```bash
npm run test:scheduled:live
```

This test contacts public providers and exercises local disk-backed persistence. **It does not verify an actual Cloudflare Cron execution.**

## Deployment

- **Cloudflare Pages:** public interface from the `dist/` directory
- **Cloudflare Worker:** read-only data APIs and scheduled source checks
- **Cloudflare D1:** versioned research datasets and collection health
- **Python scripts:** historical reconstruction and statistical model building
- **GitHub:** implementation, tests and reproducible methodology

Explore the live datasets and collection timestamps using [Data Freshness](https://talvoryn.pages.dev/methodology.html) or the [public source-health API](https://talvoryn.pages.dev/api/health). Published analyses distinguish their observation dates from the time the source was checked.

For the precise setup and verification procedure, see [Architecture](docs/ARCHITECTURE.md). Keep credentials in secret storage, not the repository.

## Verification and research definitions

Talvoryn makes research figures inspectable through its [Methodology](https://talvoryn.pages.dev/methodology.html), [Technical Methodology](docs/METHODOLOGY.md) and original source records. Each dataset identifies its date range and source. For reproducible exchange attribution, see the public whale API and its event receipts above. Missing observations are not silently treated as measured zeros.

---

**Talvoryn — NEAR intelligence through technical, fundamental and on-chain research.**
