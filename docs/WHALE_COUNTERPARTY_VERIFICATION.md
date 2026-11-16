# Whale counterparty discovery and verification

## Objective

Investigate the actual on-chain counterparties of the fixed 48 monitored NEAR wallets; build a verifiable, maintainable CEX and DEX attribution registry; reconstruct rolling 24-hour, seven-day, and 30-day exchange-related flows. **Do not use an unknown counterparty as evidence of a trade.**

## Implemented (16 November 2026)

- The incremental collector records unknown counterparties it sees in new FastNEAR pages, without adding external calls or changing public flow totals.
- A separate **owner-only 30-day discovery backfill** scans all 48 wallets over a **fixed window**. It persists page cursor, wallet index, page count and transaction count in D1; individual candidates now live in the `whale_discovery_candidates` table, separate from the compact checkpoint in `whale_discovery_state`. It never writes the public `whales` dataset or the allowlist.
- The backfill is limited to **20 FastNEAR transfer calls per manual invocation**, with no automatic retries. The existing two-batch live whale collector and its Cloudflare request budget are unchanged.
- A successful page commits its candidate changes and cursor together in one D1 transaction; a failed page can be retried without skipping a wallet. Existing candidate records are merged by account, and sample receipt IDs are deduplicated.
- The original 600-candidate in-memory limit is no longer used by the production endpoint. The first 437 saved candidates migrate from the original D1 dataset to independent D1 rows without losing the 12-wallet checkpoint; historical samples are retained but are not presented as verified trade evidence.
- Automated tests verify the fixed window, 48-wallet iteration, 20-call ceiling, paginated continuation, failure recovery, and separation from published metrics.

## Operator procedure (not a public endpoint)

Only after deployment, use the existing owner authentication token; do not share the token.

- `POST /api/admin/whale-discovery-backfill?mode=status` — read stored progress; **no FastNEAR calls**.
- `POST /api/admin/whale-discovery-backfill?mode=advance` — scan up to 20 pages, checkpoint in D1. Review progress and source errors before further passes.
- `POST /api/admin/whale-discovery-backfill?mode=candidates` — read up to 100 candidate entries ordered by number of whales interacting and transfer count; **no FastNEAR calls**.

A backfill's `from` and `to` remain frozen after its first invocation. Each candidate is a lead for investigation, **not** a verified trading venue. Do not deploy a candidate as a recognised exchange solely because it interacted with many wallets.

## Attribution evidence required

### CEX addresses

- Verify that the **exact NEAR account** is controlled by a specific exchange, using exchange-published account lists, authenticated proof-of-reserves disclosures, traceable official documentation, or independently corroborated evidence.
- Exclude addresses labelled as third-party custody or whose function cannot be distinguished from personal or treasury accounts.
- Record an evidence URL, accessed date, exact address, exchange name, and classification decision in a reviewed registry diff.
- A transfer to a verified CEX may be a deposit; a transfer from it may be a withdrawal. Neither alone proves a sale or purchase.

### DEX swaps

- Identify the relevant NEAR contract through reproducible source code, published deployment configuration, or on-chain contract verification.
- Inspect the successful transaction and receipts: actual swap event, token in/out, user, and exact NEAR/wNEAR amount. A token transfer to a DEX contract is not necessarily a trade.
- Do not count failed transactions, wrapped/unwrapped balances by themselves, liquidity deposits, bridge transfers, internal transfers or wallet-to-wallet movements as swaps.

## Historical reconstruction and audit gates

1. Complete the backfill with all 48 wallets and **no failed page commits** or unresolved page errors.
2. Independently verify candidate CEX and DEX addresses. Preserve unresolved classifications as unknown.
3. Update the allowlist with traceable evidence and regression tests only; no automatic registry promotion.
4. Reconstruct the original 30-day interval from transaction receipts after the registry review, and reconcile each ledger event once by receipt ID and transfer index. No duplicated events or unsupported backfilled DEX claims.
5. Confirm the 24h/7d/30d windows, D1 outputs, public API and visible Overview figures match before publishing revised flows.
6. Preserve historical windows, incomplete source periods, and exact UTC data-through timestamps. Separate observed transfers from financial interpretations.

## Operational trade-offs

- This procedure consumes one FastNEAR query per page, bounded to 20 per pass. It is **not** free in FastNEAR credit terms; estimate from actual pages and stop on source errors.
- The complete 30-day history may require additional pages beyond the 48 first pages; the endpoint can resume without restarting.
- Candidate records use individual D1 rows instead of one large JSON checkpoint, avoiding the previous 600-candidate cap. D1 storage and request limits still apply; monitor database size and stop on any failed page commit rather than advance the cursor.
- Results from historical backfill are an evidence queue, not automatic proof of exchange ownership.
- Confirm unattended cron success separately; manual owner runs are not evidence of cron execution.
