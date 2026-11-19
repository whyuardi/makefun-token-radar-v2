// Farm plans for the token radar: one 6-step plan per protocol, built from
// the protocol's own snapshot figures (category, chains, TVL). Every step
// names a concrete action, the chain it happens on, what it costs, how long
// it takes and what it gets you. Gas figures are rough per-transaction
// estimates for the named chain, not quotes.

export interface FarmInput {
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
}

// Rough per-transaction gas cost in USD, by chain as DefiLlama names it.
const GAS: Record<string, [number, number]> = {
  Ethereum: [3, 9],
  Base: [0.05, 0.25],
  Binance: [0.1, 0.4],
  Arbitrum: [0.1, 0.4],
  Solana: [0.01, 0.05],
  Monad: [0.01, 0.05],
  'Hyperliquid L1': [0.01, 0.05],
  Avalanche: [0.2, 0.8],
  Plasma: [0.02, 0.1],
  'Robinhood Chain': [0.05, 0.2],
  Berachain: [0.05, 0.3],
  Optimism: [0.05, 0.3],
  Unichain: [0.05, 0.25],
  Polygon: [0.02, 0.1],
  Bitcoin: [1, 5],
  Sonic: [0.02, 0.1],
  Flare: [0.05, 0.2],
  'Plume Mainnet': [0.02, 0.1],
  Arc: [0.05, 0.2],
  Katana: [0.02, 0.1],
  Linea: [0.05, 0.3],
  Tron: [0.5, 2],
  zkSync: [0.05, 0.3],
  Scroll: [0.05, 0.3],
  Sei: [0.01, 0.05],
  Sui: [0.01, 0.05],
  Aptos: [0.01, 0.05],
};

function gas(chain: string): string {
  const g = GAS[chain] ?? [0.1, 1];
  const fmt = (n: number): string => (n < 1 ? `$${n.toFixed(2)}` : `$${n}`);
  return `${fmt(g[0])}–${fmt(g[1])}`;
}

// A sensible position size for farming, scaled to the protocol's own TVL.
function band(tvl: number): string {
  if (tvl < 25_000_000) return '$50–$200';
  if (tvl < 200_000_000) return '$200–$1,000';
  return '$500–$5,000';
}

type Ctx = { name: string; chain: string; chain2: string; g: string; g2: string; band: string };
type Template = (c: Ctx) => string[];

function ctx(p: FarmInput): Ctx {
  const chain = p.chains[0] ?? 'Ethereum';
  const chain2 = p.chains[1] ?? chain;
  return { name: p.name, chain, chain2, g: gas(chain), g2: gas(chain2), band: band(p.tvl_usd) };
}

const TEMPLATES: Record<string, Template> = {
  'Risk Curators': (c) => [
    `Open ${c.name} on ${c.chain} and pick one curated vault whose strategy you understand (10 minutes of reading first) — deposit ${c.band} of USDC into it (about ${c.g} in gas, 5 minutes).`,
    `Confirm the vault receipt token lands in your wallet and the deposit shows in ${c.name}'s ${c.chain} position page (about ${c.g}, 5 minutes) — that receipt is your farming proof.`,
    `Leave the deposit untouched for at least 4 weeks so the curator's rebalancing history covers your whole position; check the vault's allocation report weekly (free to read, 5 minutes).`,
    `If the vault opens a second strategy on ${c.chain2}, split ${c.band} across the two vaults instead of doubling one (about ${c.g2} per deposit, 10 minutes) to widen the activity record.`,
    `Top up the original vault once with a smaller amount after week 2 (about ${c.g}, 5 minutes) — a second deposit timestamps fresh activity without resetting the first.`,
    `Before any points snapshot, verify both deposits and the receipt tokens are still visible in ${c.name}'s history, then withdraw only after the campaign closes — early exit can void the farming record.`,
  ],
  Dexs: (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} via the chain's official bridge (about ${c.g} in gas, 10–20 minutes) so you hold funds where ${c.name} trades.`,
    `Swap half the USDC for the paired asset on ${c.name} on ${c.chain} (about ${c.g}, 2 minutes) to hold both sides of the pool you will farm.`,
    `Add both assets as liquidity to ${c.name}'s highest-volume pool on ${c.chain} (about ${c.g}, 5 minutes) and keep the LP receipt — it is the position the farm tracks.`,
    `Swap a small amount ($10–$25) through the same pool once a week (about ${c.g} per swap, 2 minutes) so the wallet shows trader activity as well as LP activity.`,
    `Claim any trading fees or pool rewards that accrue after 2 weeks (about ${c.g}, 5 minutes) and re-add them to the same pool to compound the position.`,
    `Keep the LP position open for at least 6 weeks, then check ${c.name}'s ${c.chain} history shows the add, swaps and claims before removing liquidity — a bare deposit with no trades reads as idle.`,
  ],
  'Onchain Capital Allocator': (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and open ${c.name}'s allocation page to compare its vaults (10 minutes of reading).`,
    `Deposit into the allocator's flagship vault on ${c.chain} (about ${c.g}, 5 minutes) and save the vault receipt token — it proves the allocation.`,
    `Read the allocator's monthly report for the vault (free, 10 minutes) and note which strategies it rotated into, so you can describe the position if asked.`,
    `After 3 weeks, allocate a second, smaller tranche to a different vault on ${c.chain2} (about ${c.g2}, 10 minutes) to show activity across two of its products.`,
    `Claim any yield the vaults distribute after a month (about ${c.g}, 5 minutes) and re-deposit it into the flagship vault to compound.`,
    `Hold both allocations for at least 6 weeks and confirm each deposit, claim and re-deposit appears in ${c.name}'s history before withdrawing anything — the record is the farm.`,
  ],
  RWA: (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes); ${c.name} tokenises real-world assets, so expect a mint step rather than a swap.`,
    `Mint or buy ${c.name}'s tokenised asset with the USDC on ${c.chain} (about ${c.g}, 5–10 minutes) and keep the mint receipt — it is the position the farm tracks.`,
    `If the asset pays yield, claim the first distribution after 2–4 weeks (about ${c.g}, 5 minutes) and record the amount; unclaimed yield still counts, claimed yield proves activity.`,
    `Hold the position for at least 6 weeks — RWA farms reward duration over frequency — and check the holding still shows in ${c.name}'s ${c.chain} dashboard weekly (free, 5 minutes).`,
    `If ${c.name} lists a second asset on ${c.chain2}, take a smaller second position there (about ${c.g2}, 10 minutes) to widen the record across two assets.`,
    `Before any snapshot, verify the mint, the holding and any claims all appear in ${c.name}'s history, then exit only after the campaign closes — early redemption can void the farming record.`,
  ],
  Lending: (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} through the chain's official bridge (about ${c.g} in gas, 10–20 minutes) so you hold funds where ${c.name} lends.`,
    `Supply the USDC into ${c.name}'s main lending market on ${c.chain} (about ${c.g}, 5 minutes) to open a deposit position and start earning supply yield.`,
    `Borrow a smaller amount of a volatile asset against the deposit — keep loan-to-value under 50% — (about ${c.g}, 5 minutes) to activate the borrow side of the position.`,
    `Repay part of the loan, then re-supply the freed collateral (about ${c.g} per transaction, 10 minutes) to loop the position once without pushing the health factor under 1.8.`,
    `Leave the position open for at least 4 weeks, topping up the deposit weekly if the health factor slips (about ${c.g} per top-up, 5 minutes), to build a continuous usage record.`,
    `Confirm the supply, borrow, repay and loop all show in ${c.name}'s ${c.chain} activity history, then unwind only after any points campaign closes — closing early can void the farming record.`,
  ],
  Yield: (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and read ${c.name}'s vault list to pick the highest-TVL strategy you understand (10 minutes).`,
    `Deposit into that vault on ${c.chain} (about ${c.g}, 5 minutes) and keep the vault receipt token — it is your farming proof.`,
    `After 2 weeks, harvest any yield the vault distributes (about ${c.g}, 5 minutes) and re-deposit it into the same vault to compound the position.`,
    `Open a second, smaller position in a different ${c.name} vault on ${c.chain2} (about ${c.g2}, 10 minutes) so the record spans two strategies, not one.`,
    `Repeat the harvest-and-compound step once more after another 2 weeks (about ${c.g}, 5 minutes) — repeated harvests read as sustained use, not a one-off deposit.`,
    `Hold both vault positions for at least 6 weeks and verify every deposit and harvest appears in ${c.name}'s history before withdrawing — a single deposit with no harvests looks idle.`,
  ],
  Derivatives: (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and deposit it as margin on ${c.name} (about ${c.g}, 5 minutes).`,
    `Open a small perpetual position — no more than 2x leverage and under 20% of the margin — on ${c.name} on ${c.chain} (about ${c.g}, 2 minutes) to start trading activity.`,
    `Close the position after a day or two, booking the result (about ${c.g}, 2 minutes), then open a second small position in the opposite direction to show two-way activity.`,
    `Repeat the open-and-close cycle once a week for 4 weeks (about ${c.g} per trade, a few minutes each) — steady small volume beats one large trade for farming.`,
    `Keep total losses capped: if the margin falls 20%, stop trading, top the margin back up with a small amount (about ${c.g}, 5 minutes) and continue the weekly cycle.`,
    `After 4 weeks of cycles, confirm the deposits and every trade appear in ${c.name}'s ${c.chain} history, then withdraw margin only after any campaign closes — the trade log is the farm.`,
  ],
  CDP: (c) => [
    `Bridge ${c.band} of ETH or a liquid staking token to ${c.chain} (about ${c.g} in gas, 10–20 minutes) to have collateral where ${c.name} runs.`,
    `Lock the collateral in a ${c.name} vault on ${c.chain} (about ${c.g}, 5 minutes) and mint its stablecoin against it at under 50% of the maximum — keep the ratio safe.`,
    `Use the minted stablecoin: swap half for USDC on ${c.chain} (about ${c.g}, 2 minutes) and hold the rest, so the mint leads to real on-chain use.`,
    `After 2 weeks, repay a quarter of the minted debt (about ${c.g}, 5 minutes) to show active vault management rather than a mint-and-forget.`,
    `Top up the collateral once if the collateral ratio drifts toward the liquidation line (about ${c.g}, 5 minutes) — a vault that survives a dip reads as managed.`,
    `Hold the vault open for at least 6 weeks, verify the lock, mint, swap and repay all show in ${c.name}'s history, then close the vault only after any campaign closes.`,
  ],
  'Yield Aggregator': (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and compare ${c.name}'s auto-compounding vaults (10 minutes of reading).`,
    `Deposit into the highest-TVL vault on ${c.chain} (about ${c.g}, 5 minutes); the aggregator compounds for you, so the deposit itself is the core action.`,
    `After 2 weeks, check the vault's harvest log (free, 5 minutes) to confirm auto-compounds ran on your share — no claim step is needed.`,
    `Add a second, smaller deposit to a different vault on ${c.chain2} (about ${c.g2}, 10 minutes) to spread the record across two of its strategies.`,
    `Withdraw a small test amount from the first vault after week 4 (about ${c.g}, 5 minutes), then re-deposit it — the round trip proves you control the position.`,
    `Keep both vaults funded for at least 6 weeks and confirm every deposit and the test round trip appear in ${c.name}'s history before any final withdrawal.`,
  ],
  'Basis Trading': (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and fund ${c.name}'s basis vault or delta-neutral strategy (about ${c.g}, 5 minutes).`,
    `Confirm the position opens delta-neutral — the strategy hedges the spot leg with a short — and save the position receipt (5 minutes of reading the position page).`,
    `Leave the position to accrue funding-rate yield for at least 3 weeks, checking the funding payments weekly (free, 5 minutes) so you can describe the yield source.`,
    `After 3 weeks, add a smaller top-up to the same strategy (about ${c.g}, 5 minutes) to timestamp fresh activity on an aged position.`,
    `If ${c.name} offers a second basis market on ${c.chain2}, open a smaller position there (about ${c.g2}, 10 minutes) to widen the record.`,
    `Hold for at least 6 weeks total, verify the funding, top-up and second position all show in ${c.name}'s history, then exit only after any campaign closes.`,
  ],
  Chain: (c) => [
    `Bridge ${c.band} of ETH or USDC to ${c.chain} via its official bridge (about ${c.g} in gas, 10–20 minutes) — farming a chain means using its apps, not just holding.`,
    `Swap a small amount on the chain's leading DEX (about ${c.g}, 2 minutes) to register a first trade on ${c.chain}.`,
    `Deposit ${c.band} into ${c.name}'s flagship app on ${c.chain} — staking, lending or its native vault — (about ${c.g}, 5 minutes) and keep the receipt.`,
    `Use a second native app on ${c.chain} once a week for 3 weeks (about ${c.g} per use, a few minutes each) — chains reward breadth of use.`,
    `Claim any staking or usage rewards after a month (about ${c.g}, 5 minutes) and re-stake them into the flagship app to compound.`,
    `Keep the flagship position open for at least 6 weeks and confirm the bridge, swaps, app uses and claims all appear in ${c.chain} history before withdrawing.`,
  ],
  'Staking Pool': (c) => [
    `Bridge ${c.band} of the stakeable asset to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and open ${c.name}'s staking page (5 minutes of reading).`,
    `Stake the full amount in ${c.name}'s pool on ${c.chain} (about ${c.g}, 5 minutes) and keep the staking receipt token — it is your farming proof.`,
    `Claim staking rewards after 2–3 weeks (about ${c.g}, 5 minutes) and re-stake them into the same pool to compound the position.`,
    `If ${c.name} runs a second pool on ${c.chain2}, stake a smaller amount there (about ${c.g2}, 10 minutes) to widen the record across two pools.`,
    `Repeat the claim-and-restake step once more after another 2 weeks (about ${c.g}, 5 minutes) — repeated restakes read as sustained staking, not a one-off.`,
    `Hold both stakes for at least 6 weeks, verify every stake, claim and restake appears in ${c.name}'s history, then unstake only after any campaign closes.`,
  ],
  'Liquidity Manager': (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and read ${c.name}'s managed-range options (10 minutes).`,
    `Deposit both sides of a pair into ${c.name}'s managed liquidity vault on ${c.chain} (about ${c.g}, 5 minutes) — the manager rebalances the range for you.`,
    `After 2 weeks, check the vault's rebalance log (free, 5 minutes) to confirm your share moved with the range at least once.`,
    `Top up the vault with a smaller amount after a rebalance (about ${c.g}, 5 minutes) to timestamp activity on a live managed position.`,
    `If ${c.name} manages a second pool on ${c.chain2}, open a smaller position there (about ${c.g2}, 10 minutes) to spread the record.`,
    `Keep the managed positions open for at least 6 weeks and confirm deposits, rebalances and top-ups all show in ${c.name}'s history before withdrawing.`,
  ],
  'Leveraged Farming': (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and open ${c.name}'s leveraged farm list (10 minutes of reading the risks first).`,
    `Open a leveraged position at no more than 2x on ${c.name} on ${c.chain} (about ${c.g}, 5 minutes) and note the liquidation price — never farm above 2x.`,
    `Check the position's health daily for the first week (free, 2 minutes a day); top up collateral once if health slips (about ${c.g}, 5 minutes).`,
    `Harvest farming rewards after 2 weeks (about ${c.g}, 5 minutes) and re-deposit them into the same farm to compound.`,
    `Reduce leverage by a third after week 3 (about ${c.g}, 5 minutes) to show active risk management rather than a set-and-forget.`,
    `Hold the de-leveraged position for at least 6 weeks total, verify the open, top-up, harvest and deleverage all show in ${c.name}'s history, then close only after any campaign closes.`,
  ],
  Restaking: (c) => [
    `Bridge ${c.band} of a liquid staking token to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and open ${c.name}'s restaking page (5 minutes of reading).`,
    `Restake the tokens in ${c.name}'s main pool on ${c.chain} (about ${c.g}, 5 minutes) and keep the restaking receipt — it is your farming proof.`,
    `Delegate the restaked position to one of ${c.name}'s operators (about ${c.g}, 5 minutes) — delegation is a separate on-chain action the farm can see.`,
    `After 3 weeks, claim restaking rewards (about ${c.g}, 5 minutes) and restake them into the same pool to compound.`,
    `If ${c.name} lists a second operator on ${c.chain2}, split a smaller amount to it (about ${c.g2}, 10 minutes) to show activity across two operators.`,
    `Hold the restaked position for at least 6 weeks, verify the restake, delegation, claims and split all appear in ${c.name}'s history, then exit only after any campaign closes.`,
  ],
  'Prediction Market': (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and browse ${c.name}'s open markets for one resolving in 2–4 weeks (10 minutes).`,
    `Buy a small position in that market on ${c.chain} (about ${c.g}, 2 minutes) — keep each bet under 10% of the bridged amount.`,
    `Take a second, smaller position in a different market on ${c.name} (about ${c.g}, 2 minutes) so the record shows two markets, not one bet.`,
    `Add liquidity to one market's pool if ${c.name} offers it (about ${c.g}, 5 minutes) — providing liquidity is steadier farming than betting alone.`,
    `After the first market resolves, claim any winnings (about ${c.g}, 5 minutes) and roll half into a new market position.`,
    `Keep trading or providing liquidity weekly for at least 4 weeks and confirm every buy, liquidity add and claim appears in ${c.name}'s ${c.chain} history.`,
  ],
  'Stablecoin Wrapper': (c) => [
    `Bridge ${c.band} of the underlying stablecoin to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and open ${c.name}'s wrap page (5 minutes).`,
    `Wrap the stablecoin into ${c.name}'s wrapped form on ${c.chain} (about ${c.g}, 5 minutes) and keep the wrapped tokens — the wrap is the core action.`,
    `Use the wrapped tokens in a ${c.chain} lending market: supply them (about ${c.g}, 5 minutes) so the wrap leads to real usage, not a parked balance.`,
    `After 2 weeks, unwrap a small test amount (about ${c.g}, 5 minutes) and re-wrap it — the round trip proves you control the position.`,
    `If ${c.name} supports a second chain, wrap a smaller amount on ${c.chain2} (about ${c.g2}, 10 minutes) to widen the record.`,
    `Hold the wrapped supply position for at least 6 weeks, verify the wrap, supply and round trip all show in ${c.name}'s history, then unwrap only after any campaign closes.`,
  ],
  CeDeFi: (c) => [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) and read ${c.name}'s product terms — CeDeFi mixes custody with on-chain vaults (10 minutes).`,
    `Deposit into ${c.name}'s main on-chain vault on ${c.chain} (about ${c.g}, 5 minutes) and save the vault receipt token as farming proof.`,
    `If ${c.name} offers a yield product on ${c.chain}, allocate a smaller amount to it (about ${c.g}, 10 minutes) so the record spans two of its products.`,
    `After 3 weeks, claim or harvest any yield the vaults pay (about ${c.g}, 5 minutes) and re-deposit it into the main vault.`,
    `Check the vault's on-chain attestations weekly (free, 5 minutes) and note the custodian's reported backing — CeDeFi farms reward users who verify.`,
    `Hold both allocations for at least 6 weeks, confirm every deposit and harvest appears in ${c.name}'s history, then withdraw only after any campaign closes.`,
  ],
};

// Fallback for categories without their own template: still concrete, built
// from the protocol's real chain, TVL band and category name.
function generic(c: Ctx, category: string): string[] {
  return [
    `Bridge ${c.band} of USDC to ${c.chain} (about ${c.g} in gas, 10–20 minutes) so you hold funds where ${c.name} runs.`,
    `Open ${c.name}'s main ${category} product on ${c.chain} and deposit ${c.band} (about ${c.g}, 5–10 minutes); keep the receipt token — it is your farming proof.`,
    `Use the position once in its first week — a swap, a claim or a rebalance inside ${c.name} on ${c.chain} (about ${c.g}, 5 minutes) — so the record shows activity, not just a deposit.`,
    `After 2 weeks, add a smaller top-up to the same product (about ${c.g}, 5 minutes) to timestamp fresh activity on the aged position.`,
    `If ${c.name} runs on ${c.chain2} as well, repeat the deposit there with a smaller amount (about ${c.g2}, 10 minutes) to widen the record across two chains.`,
    `Hold the positions for at least 6 weeks, verify the deposits, the use and the top-up all appear in ${c.name}'s history, then exit only after any campaign closes.`,
  ];
}

export function farmSteps(p: FarmInput): string[] {
  const c = ctx(p);
  const t = TEMPLATES[p.category ?? ''];
  const steps = t ? t(c) : generic(c, p.category ?? 'protocol');
  return steps.map((s) => s.trim());
}
