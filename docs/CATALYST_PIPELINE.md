# Catalyst collection and verification

**Purpose:** Track NEAR developments, distinguish claims from implementation, and connect them to measured activity without inventing causality. This is a separate review process within Talvoryn's existing Cloudflare Worker/D1 stack.

## Hourly collection

`worker/catalyst-discovery.mjs` checks four public sources independently:

| Source | What is collected | Policy |
| --- | --- | --- |
| NEAR Governance | Relevant topic titles and canonical links | Discussion is a proposal, not an enacted change |
| GitHub NEPs | Relevant proposal titles, updates, merge indications | A merged PR is not proof of deployment |
| NEAR official blog | Relevant official announcement links | Announcement is not proof of adoption |
| NEAR Hackathon directory | Official public submission count when present | Count is *submissions*, not shipped apps |

Discovery uses stable candidate IDs, bounded responses, retries via the next hourly job, source-by-source health and duplicate prevention. Failure at one provider does not replace successful previously saved information. Unparsed hackathon counts are **unavailable**, not zero or a guessed number. Site markup may change, so a failed parser must surface as a source error.

New candidates are stored in D1 as `catalyst-discovery` and **never auto-published**.

## Four review stages

- **Proposed** — a publicly documented idea or decision awaiting implementation.
- **Announced** — a company or team has said a feature, integration or event exists; independently verified deployment is not implied.
- **Shipped** — an implementation or launch is supported by **additional** evidence beyond the original announcement.
- **Measured** — an actual adoption/economic observation is linked, with the source and period disclosed.

The protected `POST /api/admin/catalyst-review` requires `OWNER_API_TOKEN`, a candidate `id`, `decision` (`approve` or `reject`) and, for approvals, a `stage`, verified `eventDate` (`YYYY-MM-DD`), `summary`, `effect`, `next`, `evidenceURL` and optional `affects`, `kind` and `metricSource`. A `Measured` label requires `metricSource`; a `Shipped` or `Measured` label cannot rely only on the original announcement URL. An approval publishes a human-written, source-linked article to D1; rejection removes the candidate.

Keep the owner token in Cloudflare secret storage. Do not send it through the public website or commit it to GitHub. The private candidate queue is available at `GET /api/admin/catalyst-candidates` with the same bearer token.

## Read-only public endpoints

- `GET /api/catalysts` — reviewed Catalyst articles; includes seven-day context when both comparison windows are complete
- `GET /api/catalysts/hackathon` — official submission count with UTC check time or a clear unavailable status
- `GET /api/catalysts/source-health` — source check outcomes and pending candidate count
- `GET /api/health` — scheduled job health; verify `catalyst-discovery` with recent `lastSuccess` and `scheduledTime`

The website uses the official project directory for browsing individual submitted projects: https://nearhackathon.com/#projects. The submission count is not a count of independent builders or launched apps.

## Economic context

`worker/catalyst-impact.mjs` compares seven **complete UTC days before** an event with seven complete days after it, **excluding the event day**, for NEAR Intents trading volume, gross fees and revenue. This is displayed only when every day's figures are available. No estimates are inserted for missing dates. The comparison is descriptive and **does not prove a catalyst caused a movement**. The comparison also is not automatic evidence for the `Measured` status.

## Deployment checklist

1. Run `node --test tests/catalyst-discovery.test.mjs tests/catalyst-review.test.mjs tests/catalyst-impact.test.mjs` and `node --check worker/production.mjs`. GitHub Actions also runs these checks on relevant changes.
2. Deploy the updated `worker/production.mjs` to the already provisioned `talvoryn-data` Worker. Preserve the existing free D1 `DB` binding, `DATA_WORKER` service binding, secrets and current datasets.
3. Confirm the hourly Cron `7 * * * *` is active. Avoid changing the three-hour whale Cron `17 */3 * * *`.
4. After an hourly execution, inspect `/api/health`, `/api/catalysts/source-health` and `/api/catalysts/hackathon`. Confirm actual timestamps and check each source's success or failure, rather than assuming configuration proves execution.
5. Review one candidate with source evidence. Confirm the public `/api/catalysts` entry and its detailed card on `/catalysts.html`.
6. If the hackathon site changes its pagination markup, adjust and test the extractor first. **Never hardcode a stale count as live.**

**Deployment status:** GitHub implementation is not evidence of Worker deployment or a successful production schedule. The next verification is the production health endpoint after an authorised deploy.
