# Disclosure Lab

**The trade. The disclosure. The difference.**

A source-linked research application comparing hypothetical stock purchases on a politician's reported transaction date with purchases after the official filing date. The interesting part is the accounting, evidence and limitations—not a sensational leaderboard.

## Features

- Two cash-constrained portfolios plus SPY or QQQ buy-and-hold.
- Configurable politician, dates, holding period, allocation, capital, costs, execution delay, account owner, ticker, amount floor and filing lag.
- Equity curves, drawdown, trade-level calculations, explicit exclusions and original House PDF links.
- Copyable experiment settings and JSON exports with provenance, daily equity and trade audit.
- Identical deterministic TypeScript engine in the browser and command line.
- Python ingestion, automated source-PDF checks, snapshot validation and engine tests.
- Responsive dark React interface with accessible component primitives and Recharts.

No brokerage, orders, database or always-on API. Fetching/validating data happens offline; the site serves a snapshot and computes experiments locally. There is no hidden server-side trading engine.

## Run locally

Requires Node **22.18+**, npm and Python **3.11+**. Python is only needed to build/refresh the snapshot.

```sh
npm ci
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/build-snapshot.py
npm run validate:data
npm run dev
```

Open the printed localhost address. The first refresh downloads official indexes, PDFs and historical prices; allow several minutes. Subsequent builds reuse `.cache/research/`. Failures cause explicit exclusions or errors, never fabricated data.

**The public repository does not bundle Yahoo price history.** `public/data/snapshot.json` and raw caches are ignored because redistribution rights have not been established. Until you generate it, the app displays a missing-snapshot message. Normalized disclosures and the original snapshot's provenance/checksum are public. Review provider terms before fetching or republishing market data; obtain licensed data for a public commercial deployment. Public code does not imply a public hosted instance or public market-data license.

## Reproduce and test

```sh
npm test
npm run typecheck
npm run validate:data
npm run research -- --output result.json
```

An exported browser experiment works directly as CLI input:

```sh
npm run research -- --config disclosure-experiment.json --output result.json
```

Or supply a JSON object with configuration overrides:

```json
{
  "member": "house_marjorietaylor_greene",
  "from": "2021-01-01",
  "to": "2026-09-04",
  "benchmark": "SPY",
  "holding": 63,
  "delay": 0,
  "costBps": 10,
  "capital": 10000,
  "allocation": 10
}
```

Other fields: `owner` (`all`, `SP`, `JT`, `self`), `ticker` (empty means all), `minAmount` (reported lower bound), `maxLag` (calendar days). Member IDs are in `public/data/disclosures.json`; `all` combines the three filers in one shared-cash portfolio. `npm run research -- --help` lists CLI flags.

Refresh prices/indexes while retaining the pinned disclosure input:

```sh
python scripts/build-snapshot.py --as-of 2026-09-04 --refresh
npm run validate:data -- --record
```

To update disclosures, explicitly pass `--revision FULL_40_CHARACTER_UPSTREAM_COMMIT` and `--as-of YYYY-MM-DD`. Changing the cutoff alone does not advance the pinned dataset. Review exclusion/provenance changes before publication. Identical snapshot bytes and settings give identical results; rerunning upstream endpoints later may not reproduce the older snapshot because adjusted prices and documents can be revised. Preserve caches privately for auditing.

## Sources and coverage

### Portrait directory

The **Politicians** tab adds a separate searchable historical House/Senate directory. Search names/state abbreviations and filter chamber, party and backtest readiness. Source-profile aliases and cross-chamber histories are consolidated by corrected Bioguide identity; raw source links remain available. This is not a roster of all current elected officials. Directory membership does not expand the three-person verified backtest universe or imply verified returns.

The initial directory has **345 consolidated profiles and 344 available portraits**, from 364 upstream congressional profiles.

`npm run directory:refresh` rebuilds `public/data/directory.json` from the same pinned upstream commit and checks portrait response status/content type. Most portraits use the public-domain [unitedstates/images collection](https://github.com/unitedstates/images); missing portraits are sourced from official House/Senate biographies. Images are externally hosted, with an initials fallback if unavailable.

The portrait audit found six wrong-identity groups in the upstream metadata, including two working URLs depicting the wrong person. `public/data/portrait-corrections.json` documents identity evidence and fixes; directory generation applies them without modifying the original trading records. “A. Mitchell” remains unresolved and has no assigned portrait. Generated counts, source hash and image-check failures are recorded in the directory manifest. Portrait verification is an identity/source and HTTP check, not a guarantee of future availability.

The **How it’s built** tab explains the stack: custom TypeScript backtesting, React/Vinext interface, Recharts visualization, shadcn/Base UI primitives, Python/pypdf ingestion and Node-based tests. The cream/blue paper-workspace theme follows the supplied design reference. No external trading framework is used, and the engine is not independently institutionally validated.

### Verified backtest sample

1. Normalized input: [Kadoa Congress Trading Monitor](https://github.com/kadoa-org/congress-trading-monitor), pinned to [`464910341dbc9001387b3d5b96585bf1bc8c4e87`](https://github.com/kadoa-org/congress-trading-monitor/tree/464910341dbc9001387b3d5b96585bf1bc8c4e87). MIT attribution is in `THIRD_PARTY_NOTICES.md`. Upstream performance estimates are not used.
2. Primary documents and filing-date indexes: [House Clerk Financial Disclosures](https://disclosures-clerk.house.gov/FinancialDisclosure), annual `YYYYFD.zip` archives and original PTR PDFs.
3. Daily prices: Yahoo Finance chart responses, with source URLs and raw-response SHA-256 hashes. This is an unofficial endpoint with no availability guarantee.

Initial cutoff: **September 4, 2026**, transaction dates from 2020. There are **718** normalized records, including excluded transactions, and **431** eligible purchases before experiment-specific constraints:

| Filer | Eligible stock purchases |
| --- | ---: |
| Nancy Pelosi | 9 |
| Marjorie Taylor Greene | 411 |
| Daniel Crenshaw | 11 |

This is a selected, incomplete sample—not a complete congressional feed. There are no Senate or presidential records; Trump is not included. Pelosi's sample is particularly small because many records concern options/exercises that this stock-only engine cannot model. Account ownership may be spouse/joint; a member's name does not prove they personally placed an order.

The pipeline checked 70 original PDFs and retrieved 108 price series, including benchmarks and subsequently excluded instruments. Exact counts and snapshot checksum are in `public/data/provenance.json`.

### What verified means

Accepted rows match the official index filing date, a unique PDF ticker/type/date block, purchase direction and amount bounds. They carry source URLs, PDF hashes and extracted evidence. Ownership and issuer text come from upstream normalization and are not fully independently verified. PDF extraction is heuristic—not a manual audit or guarantee of completeness.

Options, exercises, transfers, non-equities, non-USD histories, ambiguous records, possible duplicates/amendments and missing prices are excluded. The earliest accepted duplicate candidate is retained; this can undercount separate identical transactions. Amendments are not fully reconstructed point-in-time. Unresolved price symbols include DWAC, SQ, WBA, WORK and XMEX; no silent remapping to current securities.

## Methodology

### Two clocks—not actual brokerage returns

- **Trade-date estimate (purple):** open on the transaction date or next benchmark session. Uses hindsight. Actual execution time, fill, position size and complete holdings are generally unavailable.
- **After disclosure (green):** first market open strictly after the official filing date plus extra trading-session delay. Never a filing-day opening fill based only on a date.

The filing date is a **public-availability proxy**, not an independently recorded historical publication timestamp. Documents may have become discoverable later. The green curve is therefore not a certified point-in-time investable track record. News timestamps are not modeled.

Both portfolios use records whose transaction dates are on/after test start and filing dates on/before test end. An unfiled transaction at the cutoff is also excluded from the hindsight portfolio. Amount/lag filters apply retrospectively. Changing the end date can change earlier simulated trades. This is a matched-disclosure-cohort comparison, not a reconstruction of everything each participant knew at each historical instant.

### Execution and accounting

Each purchase gets a fixed percentage of **initial** capital, inclusive of entry costs. Fractional research units; no borrowing, shorting or leverage; unused cash earns 0%. Orders lacking cash are skipped, not partially filled. Scheduled exits precede entries at each open. Competing entries sort by transaction date, then stable record ID. Repeat purchases are separate lots.

With cash budget `B`, cost fraction `c = costBps / 10000`, and adjusted entry `P`:

```text
quantity = B / (1 + c) / P
entry cash debit = B
closed proceeds = quantity * adjusted exit open * (1 - c)
daily equity = cash + sum(quantity * adjusted close of open positions)
```

Costs combine assumed fees/slippage per side. No actual spreads, liquidity, taxes or market impact. Amount ranges are filters—not pretend exact position sizes.

Holding `H` means exit at the open `H` benchmark trading sessions after entry. Each portfolio counts from its **own** entry, so exit dates differ. Open lots mark at the final close without invented sale/exit fees. Disclosed sales do not trigger exits in this purchase-only strategy.

The benchmark invests all starting cash at the first open with the same entry cost; it is not exposure-, sector- or volatility-matched. Drawdown includes starting cash as an initial peak. Per-position benchmark returns use the position's own window and are before costs.

### Prices and missing history

The pipeline uses adjusted close and multiplies split-adjusted open by `adjustedClose / close`. These are research units approximating dividend-reinvested total return, not historical executable quotes, literal share counts or exact dividend accounting. Provider corporate-action corrections may change historical results.

Every required holding-window session must have a price. No forward filling or substitution. A trade missing any required future price is excluded **in its entirety**, including at entry. This future-dependent data-availability selection may bias returns. Current symbols, missing delisted stocks and available histories also introduce selection/survivorship bias. A licensed point-in-time security master and delisting returns are needed for stronger investment conclusions.

### Interpretation

The return gap includes timing, different exit windows, cash availability, exposure and costs. It is **not pure disclosure-delay cost**, causal evidence or risk-adjusted alpha. Small samples and repeated parameter tuning can overfit. No walk-forward holdout, statistical-significance or misconduct claim. Research software, not an investment recommendation.

## How we built it

```text
Pinned normalized filings + House index/PDFs + daily prices
                 ↓ Python checks and normalization
         Private snapshot + public provenance
                 ↓ deterministic TypeScript engine
         Browser dashboard / command-line experiments
```

- `scripts/build-snapshot.py`: caching, PDF verification, exclusions, price adjustment, snapshot generation.
- `lib/backtest.ts`: pure portfolio engine with no UI or network dependency.
- `components/disclosure-lab.tsx`: controls, charts, audit, source links and export.
- `scripts/backtest.mjs`: headless runner using the same engine.
- `scripts/validate-snapshot.mjs`: IDs/dates/prices, accepted-record checks and accounting invariants across 24 real-data configurations.
- `tests/backtest.test.mjs`: small hand-checkable synthetic fixtures, never used as dashboard data.

Developed with AI coding assistance. Source checks/tests are inspectable; AI assistance is not a substitute for independent financial-data review.

## Server hosting

```sh
npm run build
npm start -- --ip 0.0.0.0 --port 8787
```

Runs the compiled Workers-compatible app through Wrangler's local runtime. For private server research, put it behind an authenticated HTTPS reverse proxy. Managed production deployment can use `dist/server/wrangler.json` with a compatible Cloudflare Workers setup. `.openai/hosting.json` identifies the original private Sites project; it is not a credential and must not be reused as someone else's project registration. Resolve data licensing before public hosting. No keys are embedded.

The original hosted Site remains owner-private; GitHub source is public. Refreshes are manual, not a live feed. The CI template at `docs/ci.yml.example` checks types, application lint, tests and builds without fetching market data. To enable GitHub Actions, copy it to `.github/workflows/ci.yml` using a GitHub connection with workflow permission. The publishing connection did not have that permission, so CI is **not activated**; these checks were run locally. A source-only CI build intentionally has no market snapshot.

`npm run lint` checks application/research code. `npm run lint:all` also includes the bundled UI component library; that unmodified scaffold has existing accessibility/type-lint findings. The production build and full TypeScript check are separate gates.

## Next research upgrades

Point-in-time publication timestamps; independent record audits; licensed raw/adjusted prices and delistings; same-exit event studies; exposure-matched benchmarks; walk-forward evaluation and uncertainty; broader coverage. Options require actual historical contract quotes and lifecycle events, not stock-price proxies.

## License

Original code: MIT. Third-party data/libraries retain their own terms. Code licensing grants no market-data redistribution rights. See `THIRD_PARTY_NOTICES.md`.
