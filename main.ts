// Token launch radar (program/v1): reads the sealed snapshot, fits a power
// law to its traded protocols, ranks the pre-token protocols by implied
// value, and writes the board, the dashboard data, the dashboard, the
// screenshots and the dossier to the output directory.
//
//   node main.ts --input /input/snapshot.json
//   MAKEFUN_OUTPUT_DIR=/output node main.ts
//
// Standard library only; no network; deterministic — two runs write the
// same bytes.

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { buildBoard } from './lib/model.ts';
import type { Snapshot } from './lib/model.ts';

const here = dirname(fileURLToPath(import.meta.url));

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

const inputPath = arg('--input') ?? '/input/snapshot.json';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const snap = JSON.parse(readFileSync(inputPath, 'utf8')) as Snapshot;
const { meta, rows } = buildBoard(snap);

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'dashboard'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

// The ranked board: one row per pre-token protocol, rank 1 the most valuable.
const board = {
  meta: {
    title: 'Power-Law Radar — pre-token protocols ranked by implied value',
    as_of: meta.as_of,
    model: `implied = TVL * clamp(10^${meta.fit_a.toFixed(4)} * TVL^${meta.fit_b.toFixed(4)} / TVL, 0.01, 1.25)`,
    calibration_protocols: meta.n_calibration,
    backtest_median_log10_error: meta.backtest_median_log_err,
    backtest_within_2x: meta.backtest_within_2x,
  },
  rows: rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    listed_at: r.listed_at,
    age_years: r.age_years,
    watchlist: r.watchlist,
    rank: r.rank,
    implied_value_usd: r.implied_value_usd,
    multiple: r.multiple,
    farmers: r.farmers,
    ev_per_farmer_usd: r.ev_per_farmer_usd,
    ev_lo_usd: r.ev_lo_usd,
    ev_hi_usd: r.ev_hi_usd,
    peers: r.peers,
    farm_steps: r.farm_steps,
  })),
};
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify(board, null, 2)}\n`, 'utf8');

// The dashboard's data, beside the page (the page loads ../data.js).
const dataJs = `window.RADAR = ${JSON.stringify({ meta, rows }, null, 2)};\n`;
writeFileSync(join(outDir, 'data.js'), dataJs, 'utf8');

// The page itself, and the screenshots captured from it.
cpSync(join(here, 'dashboard'), join(outDir, 'dashboard'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The dossier the judge reads: screenshots + dashboard source, capped text.
const dossier = buildDossier(outDir, { text_max_bytes: 65536 });
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`rows=${rows.length} watchlist=${meta.n_watchlist} fit_a=${meta.fit_a.toFixed(4)} fit_b=${meta.fit_b.toFixed(4)} cal=${meta.n_calibration} backtest_med=${meta.backtest_median_log_err.toFixed(3)} within2x=${meta.backtest_within_2x.toFixed(2)}`);
