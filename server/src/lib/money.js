// Money helpers. All amounts are whole santim (integers). 1 ETB = 100 santim.

/** Convert a percentage like 5 or 2.5 into basis points (500, 250) so maths stays in integers. */
export function pctToBps(pct) {
  return Math.round(Number(pct) * 100);
}

/**
 * Split a sale into vendor amount, agent commission and platform fee.
 * Agent commission and platform fee are rounded DOWN to the santim; the vendor gets the remainder,
 * so the three parts always add up exactly to the total.
 */
export function splitSale(totalSantim, agentPct, platformPct) {
  if (!Number.isInteger(totalSantim) || totalSantim < 0) throw new Error('total must be a non-negative integer');
  const agentBps = pctToBps(agentPct);
  const platformBps = pctToBps(platformPct);
  if (agentBps < 0 || platformBps < 0 || agentBps + platformBps > 10000) {
    throw new Error('invalid percentages');
  }
  const agent = Math.floor((totalSantim * agentBps) / 10000);
  const platform = Math.floor((totalSantim * platformBps) / 10000);
  return { vendor: totalSantim - agent - platform, agent, platform };
}

/**
 * Work out which percentages apply to an agent.
 * The vendor percentage is global. An agent override changes the agent share; the platform gets what is left.
 */
export function resolveSplit(settings, agentOverridePct) {
  const vendorPct = Number(settings.vendor_pct);
  if (agentOverridePct === null || agentOverridePct === undefined) {
    return { vendorPct, agentPct: Number(settings.agent_pct), platformPct: Number(settings.platform_pct) };
  }
  const agentPct = Number(agentOverridePct);
  const platformPct = Math.round((100 - vendorPct - agentPct) * 100) / 100;
  if (platformPct < 0) throw new Error('agent override too high');
  return { vendorPct, agentPct, platformPct };
}

/** Refund for an uncollected order: what they paid for the remaining items, minus the fee, never below zero. */
export function expiryRefund(paidSantim, feeSantim) {
  const fee = Math.min(Math.max(0, feeSantim), paidSantim);
  return { refund: paidSantim - fee, fee };
}

/** "1234.50" style string for payment providers. */
export function santimToBirrString(santim) {
  return (santim / 100).toFixed(2);
}

/** Parse "1,234.50" or 1234.5 into santim. Returns null when invalid. */
export function birrToSantim(value) {
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
