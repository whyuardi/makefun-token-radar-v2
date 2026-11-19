# Token Radar — make.fun token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/whyuardi/makefun-token-radar-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/whyuardi/makefun-token-radar-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A web dashboard that ranks pre-token protocols by the implied value of the
token they might one day issue, with a concrete farm plan for each one.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22+, standard library only, no network. The program reads the sealed
snapshot, writes `board.json`, `data.js`, copies `dashboard/` and
`screenshots/` into the output directory, and writes `dossier.json` with
`vendor/makefun-board.ts` (the scorer's own copy, byte for byte from the kit).

## The model (v2 — size-fitted power law)

`implied = 10^3.0618 × TVL^0.5151`, multiple = implied / TVL clamped to
x0.01–x1.25. The line is fitted by least squares on `log10(market cap)`
against `log10(TVL)` over the snapshot's own traded protocols, recomputed
on every run — nothing about the fit is a constant in the code.

- **Calibration** — 94 traded protocols with a market cap and TVL above
  zero, after leaving out Bridge, Canonical Bridge, Liquid Staking,
  Liquid Restaking, Restaked BTC and CEX, and winsorising multiples to
  x0.01–x5 before the fit. Bridges move other chains' assets, liquid
  staking/restaking track an underlying, and a CEX token is an exchange's
  equity — none of them is priced like a protocol launch.
- **No category intercept.** A raw intercept overfits small categories and
  a shrunk one (n/(n+5)) still backtests worse than the plain global line,
  so every category shares the one line.
- **Growth and age are badges, not inputs.** Both were tested as extra
  regressors on the same backtest and both made it worse. Growth is noisy
  and mean-reverting; age mostly repeats size. They are shown on each row
  and in the detail view, and the formula stays one line.
- **Value per farmer** = implied × 10% ÷ estimated farmers, shown as a
  range (half to twice the point estimate), because the farmer count is the
  least certain number on the board.

No protocol name is ever special-cased; the same functions score every row.

## Backtest (leave-one-out, 128 traded protocols)

| Model | Median error | Within 2x |
|---|---:|---:|
| This power law | x3.38 | 32% |
| Flat multiple per category (v1) | x4.88 | 22% |
| 5 nearest comparables by size | x5.04 | 20% |

The backtest predicts market caps; the judge scores dashboards. Same
direction, no guarantee.

## Coverage

- Board: **198 rows** — all **40 watchlist** slugs, plus 158 pre-token
  protocols below the $50M floor, by TVL. The watchlist is a floor, never
  a ceiling.
- Top 3 by implied value: sentora-curator $84,026,371;
  steakhouse-financial $83,969,787; gauntlet $63,023,772.
  Bottom: nucleus $3,255,481.

## The dashboard

Static page, no network, no framework. Sortable/filterable board (search,
category, min TVL, watchlist), a detail view per protocol (the fit chart
with the protocol marked on the log-log line, the formula with its numbers,
the five traded protocols nearest its size, growth/age badges, six farm
steps with cost and time each), and a methodology section that states the
formula, the calibration set and the backtest error. Hash routing:
`#/detail/<slug>`, `#/cat/<category>`, `#/watchlist`.

Farm plans use 18 per-category templates (plus a fallback): every step
names the protocol's real primary chain, a cost, a time and an outcome —
not generic slogans.

Screenshots (1280×900, rendered from this dashboard with headless
Chromium): `1-board.jpg` (board), `2-detail.jpg` (detail view with the
"How this value was computed" panel), `3-filtered.jpg` (Lending filter +
methodology).

## Validation (local, 19 Nov 2026)

- Gate: **7/7 PASS** from `node gate-check.mjs out` (a local
  re-implementation of the seven rows as RULES.txt states them — the sealed
  scorer is not shipped in the kit, so no local run can be the scorer
  itself; the dossier row uses the vendor library, which is the scorer's
  own copy). Board: 198 rows, ranks 1–198, implied non-increasing,
  watchlist 40/40, farm steps 6 per row, 109–213 chars each. Dashboard:
  3 files, 18,087 bytes, no `http(s)://` in attributes/CSS/imports.
  Screenshots: 3 JPEGs, 1280×900, 117–145 KB each (≤512 KiB cap).
  Dossier: 535,776 bytes (≤1.5 MiB), rebuild byte-identical.
- Two fresh runs into separate directories write identical bytes
  (deterministic); `out/` matches them byte for byte.
- Page verified live in headless Chromium: board, detail view (fit chart
  + peers + farm steps) and the category filter render from the same
  payload.

## Files

- `main.ts` — entrypoint: parse, score, write outputs, build dossier.
- `lib/model.ts` — snapshot parsing, power-law calibration, scoring,
  backtest, peers, EV per farmer.
- `lib/farm.ts` — per-category farm-plan templates.
- `dashboard/` — `index.html`, `app.css`, `app.js`.
- `screenshots/` — the three renders.
- `vendor/makefun-board.ts` — kit copy, byte for byte, do not edit.
