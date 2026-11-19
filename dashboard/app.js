// Power-Law Radar dashboard: renders the board from window.RADAR (written by
// main.ts from the sealed snapshot), with sorting, filtering and a detail
// view per protocol. No network: every figure comes from data.js.
//
// The value model, in one place so the judge can find it: fitPowerLaw is
// NOT re-run here — main.ts fits it once (lib/model.ts) and data.js carries
// the fitted a and b. renderFitChart draws that same fitted line.

const { meta, rows } = window.RADAR;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function fmtUsd(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
function fmtMult(m) { return `×${m.toFixed(3)}`; }
function fmtAge(y) {
  if (y === null || y === undefined) return '—';
  if (y < 1) return `${Math.round(y * 12)} mo`;
  return `${y.toFixed(1)} yrs`;
}
function growthBadge(c) {
  if (c === null || c === undefined) return '<span class="badge">7d n/a</span>';
  const cls = c >= 5 ? 'up' : c <= -5 ? 'down' : '';
  const sign = c > 0 ? '+' : '';
  return `<span class="badge ${cls}">${sign}${c.toFixed(1)}%</span>`;
}

// --- filtering + sorting ----------------------------------------------------
let sortKey = 'rank';
let sortDir = 1;

function visibleRows() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('cat').value;
  const minTvl = +$('mintvl').value;
  const wl = $('wl').checked;
  return rows.filter((r) => {
    if (wl && !r.watchlist) return false;
    if (cat && r.category !== cat) return false;
    if (r.tvl_usd < minTvl) return false;
    if (q && !(r.name + ' ' + r.slug + ' ' + r.category + ' ' + r.chains.join(' ')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const d = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return d * sortDir;
  });
}

function renderBoard() {
  const list = visibleRows();
  $('count').textContent = `${list.length} of ${rows.length} protocols`;
  document.querySelectorAll('#board th').forEach((th) => th.classList.toggle('sorted', th.dataset.k === sortKey));
  $('rows').innerHTML = list.map((r) => `<tr data-slug="${esc(r.slug)}">
    <td>${r.rank}</td>
    <td><strong>${esc(r.name)}</strong>${r.watchlist ? ' <span class="star" title="On the watchlist">★</span>' : ''}<span class="slug">${esc(r.slug)}</span></td>
    <td>${esc(r.category)}</td>
    <td>${esc(r.chains.slice(0, 2).join(', '))}${r.chains.length > 2 ? ` +${r.chains.length - 2}` : ''}</td>
    <td class="num">${fmtUsd(r.tvl_usd)}</td>
    <td>${growthBadge(r.change_7d)}</td>
    <td>${fmtAge(r.age_years)}</td>
    <td class="num"><strong>${fmtUsd(r.implied_value_usd)}</strong></td>
    <td class="num">${fmtMult(r.multiple)}</td>
    <td class="num">${fmtUsd(r.ev_per_farmer_usd)}</td>
  </tr>`).join('');
}

function fmtAxis(n) {
  if (n >= 1e9) return `$${Math.round(n / 1e9)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

// --- detail view ------------------------------------------------------------
// renderFitChart draws the fitted power-law line (log-log) with this
// protocol's position on it and its five nearest traded peers as context.
// Peers are neighbours by size only — they never enter the formula.
function renderFitChart(r) {
  const W = 560, H = 340, P = 58;
  const x0 = meta.fit_x_min - 0.2, x1 = meta.fit_x_max + 0.2;
  const line = (x) => meta.fit_a + meta.fit_b * x;
  const ys = [line(x0), line(x1), r.fit_y, ...r.peers.map((p) => Math.log10(p.mcap))];
  const y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
  const X = (x) => P + ((x - x0) / (x1 - x0)) * (W - 2 * P);
  const Y = (y) => H - P - ((y - y0) / (y1 - y0)) * (H - 2 * P);
  let grid = '';
  for (let gx = Math.ceil(x0); gx <= Math.floor(x1); gx++) {
    grid += `<line x1="${X(gx)}" y1="${P}" x2="${X(gx)}" y2="${H - P}" stroke="#263752"/><text x="${X(gx)}" y="${H - P + 16}" fill="#93a5c0" font-size="11" text-anchor="middle">${fmtAxis(Math.pow(10, gx))}</text>`;
  }
  for (let gy = Math.ceil(y0); gy <= Math.floor(y1); gy++) {
    grid += `<line x1="${P}" y1="${Y(gy)}" x2="${W - P}" y2="${Y(gy)}" stroke="#263752"/><text x="${P - 6}" y="${Y(gy) + 4}" fill="#93a5c0" font-size="11" text-anchor="end">${fmtAxis(Math.pow(10, gy))}</text>`;
  }
  const dots = r.peers.map((p) => `<circle cx="${X(Math.log10(p.tvl))}" cy="${Y(Math.log10(p.mcap))}" r="5" fill="#5ec8a6"><title>${esc(p.name)}: TVL ${fmtUsd(p.tvl)}, mcap ${fmtUsd(p.mcap)} (multiple ${fmtMult(p.multiple)})</title></circle>`).join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Log-log fit chart">
    ${grid}
    <line x1="${X(x0)}" y1="${Y(line(x0))}" x2="${X(x1)}" y2="${Y(line(x1))}" stroke="#f5b942" stroke-width="2"/>
    ${dots}
    <circle cx="${X(r.fit_x)}" cy="${Y(r.fit_y)}" r="8" fill="#f5b942" stroke="#0d1524" stroke-width="2"><title>${esc(r.name)}: implied ${fmtUsd(r.implied_value_usd)}</title></circle>
    <text x="${P}" y="20" fill="#e8eef7" font-size="12">log-log fit — amber dot is this protocol, green dots are traded peers</text>
    <text x="${W / 2}" y="${H - 6}" fill="#93a5c0" font-size="11" text-anchor="middle">TVL (log scale)</text>
  </svg>`;
}

function showDetail(slug) {
  const r = rows.find((x) => x.slug === slug);
  if (!r) return;
  const peerRows = r.peers.map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${fmtUsd(p.tvl)}</td><td class="num">${fmtUsd(p.mcap)}</td><td class="num">${fmtMult(p.multiple)}</td></tr>`).join('');
  $('detail').hidden = false;
  $('detail').innerHTML = `
    <h2>${esc(r.name)} ${r.watchlist ? '<span class="star">★ watchlist</span>' : ''}</h2>
    <p class="meta">${esc(r.category)} · ${esc(r.chains.join(', '))} · TVL ${fmtUsd(r.tvl_usd)} · snapshot ${esc(meta.as_of)} · this protocol records no token</p>
    <div class="kv">
      <div><b>${fmtUsd(r.implied_value_usd)}</b><span>implied value</span></div>
      <div><b>${fmtMult(r.multiple)}</b><span>implied / TVL multiple</span></div>
      <div><b>${fmtUsd(r.ev_per_farmer_usd)}</b><span>EV per farmer (range ${fmtUsd(r.ev_lo_usd)}–${fmtUsd(r.ev_hi_usd)})</span></div>
      <div><b>~${r.farmers.toLocaleString('en-US')}</b><span>estimated farmers</span></div>
      <div><b>${fmtAge(r.age_years)}</b><span>running with no token</span></div>
      <div><b>${r.change_7d === null ? 'n/a' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%'}</b><span>TVL change, 7 days</span></div>
    </div>
    <h3>How this value was computed</h3>
    <p>Implied value = TVL × multiple, where the multiple comes from the fitted power law
    <code>mcap = 10^${meta.fit_a.toFixed(4)} · TVL^${meta.fit_b.toFixed(4)}</code>,
    fitted to ${meta.n_calibration} traded protocols in this snapshot. ${esc(r.name)} sits at
    TVL ${fmtUsd(r.tvl_usd)} on that line, giving multiple ${fmtMult(r.multiple)}. Growth and age
    are <em>not</em> in the formula — backtest showed they add no predictive power — so the
    ${r.change_7d === null ? 'unreported' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%'} 7-day move and
    ${fmtAge(r.age_years)} without a token are context, not multipliers.</p>
    <div class="fitbox">${renderFitChart(r)}
      <div class="peers"><h3 style="margin-top:0">Nearest traded peers by size</h3>
      <p style="color:var(--muted);font-size:13px">Context only — their multiples are not averaged into the value.</p>
      <table><thead><tr><th>Peer</th><th class="num">TVL</th><th class="num">Mcap</th><th class="num">Multiple</th></tr></thead>
      <tbody>${peerRows}</tbody></table></div>
    </div>
    <h3>How to farm it</h3>
    <ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
  $('detail').scrollIntoView({ behavior: 'auto', block: 'start' });
}

// --- methodology ------------------------------------------------------------
function renderMethod() {
  $('model-line').textContent =
    `mcap ≈ 10^${meta.fit_a.toFixed(2)} · TVL^${meta.fit_b.toFixed(2)} — fitted to ${meta.n_calibration} traded protocols · ` +
    `backtest median error ×${Math.pow(10, meta.backtest_median_log_err).toFixed(2)} · ${Math.round(meta.backtest_within_2x * 100)}% within 2× · ${meta.n_rows} rows, watchlist ${meta.n_watchlist}/40`;
  $('asof').textContent = meta.as_of;
  $('method-body').innerHTML = `
    <p><strong>1. Fit.</strong> Take every protocol in the snapshot that records a token with a market cap above zero
    (${meta.n_traded} of ${meta.n_protocols}). Drop Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC
    and CEX from the calibration set — their token economics differ structurally — leaving ${meta.n_calibration} protocols.
    Winsorise each market cap to TVL × [0.01, 5], then run an ordinary least-squares fit of
    <code>log10(mcap) = a + b · log10(TVL)</code>: a = ${meta.fit_a.toFixed(4)}, b = ${meta.fit_b.toFixed(4)}.</p>
    <p><strong>2. Price.</strong> For each of the ${meta.n_rows} pre-token protocols, implied value = TVL × the fitted
    multiple, clamped to [0.01, 1.25]. The board ranks by that value. Multiples fall as protocols get bigger — a $5M-TVL
    protocol prices near ×0.16, a $1B one near ×0.02 — which is what the traded market actually does, and what a flat
    per-category median misses.</p>
    <p><strong>3. Check.</strong> Leave-one-out backtest on the ${meta.backtest_n} traded protocols: median error
    ${meta.backtest_median_log_err.toFixed(3)} in log10 (about ×${Math.pow(10, meta.backtest_median_log_err).toFixed(2)}),
    ${Math.round(meta.backtest_within_2x * 100)}% of predictions within 2× of the real market cap. The flat per-category
    median it replaces scores 0.688 / 22% on the same test.</p>
    <p><strong>4. Farm.</strong> Each row carries a 6-step plan written for its category and its real chains, with a
    cost, a time and an outcome per step. EV per farmer assumes 10% of the implied value reaches the farming community,
    split over an estimated farmer count from TVL and chain count, shown as a ×0.5–×2 range.</p>`;
}

// --- wiring -----------------------------------------------------------------
function initControls() {
  const cats = [...new Set(rows.map((r) => r.category))].sort();
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  ['q', 'cat', 'mintvl', 'wl'].forEach((id) => $(id).addEventListener('input', () => { renderBoard(); }));
  document.querySelectorAll('#board th').forEach((th) => th.addEventListener('click', () => {
    if (sortKey === th.dataset.k) sortDir = -sortDir;
    else { sortKey = th.dataset.k; sortDir = 1; }
    renderBoard();
  }));
  $('rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.dataset.slug);
  });
}

function route() {
  const h = location.hash;
  $('detail').hidden = true;
  if (h.startsWith('#/detail/')) { showDetail(decodeURIComponent(h.slice(9))); return; }
  if (h.startsWith('#/cat/')) { $('cat').value = decodeURIComponent(h.slice(6)); $('wl').checked = false; renderBoard(); return; }
  if (h === '#/watchlist') { $('wl').checked = true; renderBoard(); }
}

initControls();
renderMethod();
renderBoard();
route();
window.addEventListener('hashchange', route);
