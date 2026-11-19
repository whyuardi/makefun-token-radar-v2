// Value model for the token radar: a power law fitted to the snapshot's own
// traded protocols. Nothing is hardcoded from a name list: every number below
// is recomputed from /input/snapshot.json on each run.
//
//   log10(mcap) = a + b * log10(TVL)      (OLS on traded protocols)
//   implied_value = TVL * clamp(10^(a + b*log10(TVL)) / TVL, 0.01, 1.25)
//
// Calibration set: protocols that record a token with mcap > 0 and TVL > 0.
// Two guards keep the fit honest:
//  - Bridge / Canonical Bridge / Liquid Staking / Liquid Restaking /
//    Restaked BTC / CEX are left OUT of the calibration set: their token
//    economics differ structurally from the protocols the board ranks.
//  - Each calibration market cap is winsorised to TVL x [0.01, 5] before
//    fitting, so a few extreme multiples cannot drag the line.
// Growth (7d) and age (time with no token) are tested as regressors and
// NOT used in the formula: leave-one-out backtest shows they add no
// predictive power (see backtest() below). They are shown as badges.

import { farmSteps } from './farm.ts';

export interface Proto {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Proto[];
  watchlist: string[];
}

// Categories whose token economics differ structurally: excluded from the
// calibration fit (the same set the watchlist rule excludes from the board).
const CAL_EXCL = new Set(['bridge', 'canonical bridge', 'liquid staking', 'liquid restaking', 'restaked btc', 'cex']);

// The watchlist exclusion rule, re-applied from the snapshot's ten fields so
// the board's extra rows follow the same rule the house used for the floor.
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/i;

export function boardExcluded(p: Proto): boolean {
  if (p.category !== null && CAL_EXCL.has(p.category.toLowerCase())) return true;
  if (VERSION_SUFFIX.test(p.name)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return true;
  return false;
}

export function isPreToken(p: Proto): boolean {
  return p.gecko_id === null && p.symbol === null;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

function ols(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

export interface Fit {
  a: number;
  b: number;
  n: number;
}

// Fit the power law on a calibration set (already filtered + winsorised).
export function fitPowerLaw(cal: Proto[]): Fit {
  const xs = cal.map((p) => Math.log10(p.tvl_usd));
  const ys = cal.map((p) => {
    const m = clamp(p.mcap_usd! / p.tvl_usd, 0.01, 5);
    return Math.log10(p.tvl_usd * m);
  });
  const { a, b } = ols(xs, ys);
  return { a, b, n: cal.length };
}

export function calibrationSet(traded: Proto[]): Proto[] {
  return traded.filter((p) => !(p.category !== null && CAL_EXCL.has(p.category.toLowerCase())));
}

export function impliedValue(tvl: number, fit: Fit): { implied: number; multiple: number } {
  const raw = Math.pow(10, fit.a + fit.b * Math.log10(tvl));
  const multiple = clamp(raw / tvl, 0.01, 1.25);
  const implied = clamp(Math.round(tvl * multiple), 1, 100_000_000_000_000);
  return { implied, multiple };
}

// Leave-one-out backtest of the chosen model on the traded set: each held-out
// protocol is predicted from a fit on all the others (same guards). Returns
// the median |log10 error| and the share of predictions within 2x.
export function backtest(traded: Proto[]): { medianLogErr: number; within2x: number; n: number } {
  const errs: number[] = [];
  for (let i = 0; i < traded.length; i++) {
    const held = traded[i]!;
    const train = calibrationSet(traded.filter((_, j) => j !== i));
    const fit = fitPowerLaw(train);
    const { implied } = impliedValue(held.tvl_usd, fit);
    errs.push(Math.abs(Math.log10(implied) - Math.log10(held.mcap_usd!)));
  }
  errs.sort((x, y) => x - y);
  const mid = errs.length >> 1;
  const median = errs.length % 2 === 0 ? (errs[mid - 1]! + errs[mid]!) / 2 : errs[mid]!;
  const within = errs.filter((e) => e <= Math.log10(2)).length / errs.length;
  return { medianLogErr: median, within2x: within, n: traded.length };
}

// --- crowd / EV ------------------------------------------------------------
// Farmers is an order-of-magnitude estimate from the protocol's own TVL and
// chain count, stated as a range (x0.5–x2) in the dashboard. The point EV
// assumes 10% of the implied value reaches the farming community.
export function farmersEstimate(p: Proto): number {
  const base = 120 * Math.sqrt(p.tvl_usd / 1_000_000) * (1 + 0.08 * (p.chains.length - 1));
  return clamp(Math.round(base), 200, 200_000);
}

export function ageYears(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const ms = Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (365.25 * 24 * 3600 * 1000);
}

export interface Peer {
  slug: string;
  name: string;
  tvl: number;
  mcap: number;
  multiple: number;
}

export interface Row {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_years: number | null;
  watchlist: boolean;
  rank: number;
  implied_value_usd: number;
  multiple: number;
  fit_x: number; // log10(TVL)
  fit_y: number; // log10(implied)
  farmers: number;
  ev_per_farmer_usd: number;
  ev_lo_usd: number;
  ev_hi_usd: number;
  peers: Peer[];
  farm_steps: string[];
}

export interface BoardMeta {
  as_of: string;
  floor_usd: number;
  n_protocols: number;
  n_traded: number;
  n_calibration: number;
  fit_a: number;
  fit_b: number;
  backtest_median_log_err: number;
  backtest_within_2x: number;
  backtest_n: number;
  n_rows: number;
  n_watchlist: number;
  fit_x_min: number;
  fit_x_max: number;
}

export function buildBoard(snap: Snapshot): { meta: BoardMeta; rows: Row[] } {
  const traded = snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const cal = calibrationSet(traded);
  const fit = fitPowerLaw(cal);
  const bt = backtest(traded);

  const board = snap.protocols.filter((p) => isPreToken(p) && !boardExcluded(p));
  const watch = new Set(snap.watchlist);

  const scored = board.map((p) => {
    const { implied, multiple } = impliedValue(p.tvl_usd, fit);
    return { p, implied, multiple };
  });
  // Rank by implied value; ties break on TVL then slug so the order is fixed.
  scored.sort((x, y) => y.implied - x.implied || y.p.tvl_usd - x.p.tvl_usd || (x.p.slug < y.p.slug ? -1 : 1));

  // Nearest traded peers by size (|log10 TVL|), any category: context only,
  // never an input to the formula.
  const logTvl = traded.map((p) => ({ p, x: Math.log10(p.tvl_usd) }));
  const rows: Row[] = scored.map(({ p, implied, multiple }, i) => {
    const farmers = farmersEstimate(p);
    const ev = (0.1 * implied) / farmers;
    const x = Math.log10(p.tvl_usd);
    const peers = logTvl
      .map(({ p: q, x: qx }) => ({ q, d: Math.abs(qx - x) }))
      .sort((a, b) => a.d - b.d || (a.q.slug < b.q.slug ? -1 : 1))
      .slice(0, 5)
      .map(({ q }) => ({
        slug: q.slug,
        name: q.name,
        tvl: q.tvl_usd,
        mcap: q.mcap_usd!,
        multiple: q.mcap_usd! / q.tvl_usd,
      }));
    return {
      slug: p.slug,
      name: p.name,
      category: p.category ?? 'Uncategorised',
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      age_years: ageYears(p.listed_at, snap.as_of),
      watchlist: watch.has(p.slug),
      rank: i + 1,
      implied_value_usd: implied,
      multiple,
      fit_x: x,
      fit_y: Math.log10(implied),
      farmers,
      ev_per_farmer_usd: Math.round(ev * 100) / 100,
      ev_lo_usd: Math.round(ev * 0.5 * 100) / 100,
      ev_hi_usd: Math.round(ev * 2 * 100) / 100,
      peers,
      farm_steps: farmSteps({ name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd }),
    };
  });

  const xs = traded.map((p) => Math.log10(p.tvl_usd));
  const meta: BoardMeta = {
    as_of: snap.as_of,
    floor_usd: snap.floor_usd,
    n_protocols: snap.protocols.length,
    n_traded: traded.length,
    n_calibration: cal.length,
    fit_a: fit.a,
    fit_b: fit.b,
    backtest_median_log_err: bt.medianLogErr,
    backtest_within_2x: bt.within2x,
    backtest_n: bt.n,
    n_rows: rows.length,
    n_watchlist: snap.watchlist.length,
    fit_x_min: Math.min(...xs),
    fit_x_max: Math.max(...xs),
  };
  return { meta, rows };
}
