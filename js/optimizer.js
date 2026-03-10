// C# Math.Round — banker's rounding (round half to nearest even)
function bankersRound(x) {
  const fl = Math.floor(x);
  const frac = x - fl;
  if (Math.abs(frac - 0.5) < 1e-9) return (fl % 2 === 0) ? fl : fl + 1;
  return Math.round(x);
}

function applyTier(stats, tier) {
  if (tier === 'base' || !stats) return stats;
  const out = {};
  for (const k of Object.keys(stats)) {
    const v = stats[k] || 0;
    if (k === 'res') {
      out[k] = tier === 'blessed' ? v + 1 : v + 2;
    } else if (v < 0) {
      out[k] = v; // negative stats don't scale with quality tier
    } else if (tier === 'blessed') {
      out[k] = bankersRound(v * 1.5);
    } else {
      out[k] = v * 2;
    }
  }
  return out;
}

function blessedItem(item, activeTier) {
  if (activeTier === 'base') return item;
  return { ...item, stats: applyTier(item.stats, activeTier), _tier: activeTier };
}

function computeMaxScore(gear, activeTier, weights, filterLevel) {
  const fl = filterLevel || 999;
  const tieredGear = gear.map(item => blessedItem(item, activeTier));
  const claimedLines = {};
  let maxScore = 0;
  let bestPrimary = null;
  SLOTS.forEach(slot => {
    // Secondary is handled below after we know what Primary picked.
    if (slot === 'Secondary') return;
    const pool = tieredGear.filter(g => g.lvl <= fl && (g.slot === slot || (g.bothSlots && slot === 'Primary')))
      .sort((a, b) => scoreInContext(b, claimedLines, weights) - scoreInContext(a, claimedLines, weights));
    const n = MULTI_SLOTS[slot] || 1;
    if (n > 1) {
      // For multi-slots (Ring, Wrist): non-relic items can fill both slots
      // with the same item; relic items may only fill one slot each.
      const best = pool[0];
      if (best) {
        if (!best.relic) {
          // Same item in both slots — claim its line once, count score twice.
          maxScore += scoreInContext(best, claimedLines, weights) * 2;
          claimLines(best, claimedLines);
        } else {
          // Relic: pick best, claim its line, then pick best remaining for
          // the second slot with the updated context.
          const s1 = scoreInContext(best, claimedLines, weights);
          maxScore += s1;
          claimLines(best, claimedLines);
          const second = pool.slice(1).sort((a, b) => scoreInContext(b, claimedLines, weights) - scoreInContext(a, claimedLines, weights))[0];
          if (second) {
            maxScore += scoreInContext(second, claimedLines, weights);
            claimLines(second, claimedLines);
          }
        }
      }
    } else {
      if (pool[0]) {
        maxScore += scoreInContext(pool[0], claimedLines, weights);
        claimLines(pool[0], claimedLines);
      }
    }
    if (slot === 'Primary') bestPrimary = pool[0] || null;
  });
  // Secondary: skip entirely if the best Primary is two-handed; otherwise
  // exclude the Primary pick to avoid counting the same bothSlots item twice.
  if (!bestPrimary?.twoHanded) {
    const primaryName = bestPrimary?.name;
    const pool = tieredGear.filter(g => g.lvl <= fl && (g.slot === 'Secondary' || g.bothSlots) && g.name !== primaryName)
      .sort((a, b) => scoreInContext(b, claimedLines, weights) - scoreInContext(a, claimedLines, weights));
    if (pool[0]) {
      maxScore += scoreInContext(pool[0], claimedLines, weights);
      claimLines(pool[0], claimedLines);
    }
  }
  return maxScore;
}

// Fills empty/unlocked slots in manualLoadout with the best available items.
// Mutates manualLoadout in place. Does not render.
function optimize(gear, manualLoadout, slotTiers, activeTier, weights, filterLevel) {
  const fl = filterLevel || 999;
  const hasFilter = fl < 999;

  const tieredGear = gear.map(item => blessedItem(item, activeTier));
  const inRange = tieredGear.filter(g => g.lvl <= fl);
  const bySlot = {}, bySlotFallback = {};
  SLOTS.forEach(sl => { bySlot[sl] = []; bySlotFallback[sl] = []; });
  inRange.forEach(g => {
    if (bySlot[g.slot]) bySlot[g.slot].push(g);
    // Items that fit in either weapon slot are also available for Secondary
    if (g.bothSlots && bySlot['Secondary']) bySlot['Secondary'].push(g);
  });
  // If a 2H weapon is locked in Primary, clear the Secondary pool
  const primaryLocked = manualLoadout['Primary'];
  if (primaryLocked?.item?.twoHanded) {
    bySlot['Secondary'] = [];
    bySlotFallback['Secondary'] = [];
  }
  if (hasFilter) {
    tieredGear.filter(g => g.lvl > fl).forEach(g => {
      if (bySlotFallback[g.slot]) bySlotFallback[g.slot].push(g);
      if (g.bothSlots && bySlotFallback['Secondary']) bySlotFallback['Secondary'].push(g);
    });
  }

  // Track claimed spell lines across the loadout as slots are filled. Locked
  // slots are placed first so their lines are already claimed before the
  // optimizer fills remaining slots.
  const claimedLines = {};
  SLOTS.forEach(slot => {
    slotKeys(slot).forEach(key => {
      if (manualLoadout[key]?.locked) claimLines(manualLoadout[key].item, claimedLines);
    });
  });

  // For each slot key, skip if already locked; fill if empty or unlocked
  SLOTS.forEach(slot => {
    const keys = slotKeys(slot);
    keys.forEach(key => {
      // Skip locked slots (already claimed above)
      if (manualLoadout[key] && manualLoadout[key].locked) return;

      // Build pool of items not already chosen for another key of this slot.
      // Only exclude relic items — non-relic items (e.g. most rings) can
      // legitimately fill both slots with the same item.
      const usedNames = keys
        .filter(k => k !== key && manualLoadout[k]?.item?.relic)
        .map(k => manualLoadout[k].item.name);

      let pool = bySlot[slot].filter(g => !usedNames.includes(g.name));
      let isFallback = false;

      if (!pool.length && hasFilter && bySlotFallback[slot].length) {
        const minLvl = Math.min(...bySlotFallback[slot].map(g => g.lvl));
        pool = bySlotFallback[slot].filter(g => g.lvl === minLvl && !usedNames.includes(g.name));
        isFallback = true;
      }

      const sorted = pool.slice().sort((a, b) => scoreInContext(b, claimedLines, weights) - scoreInContext(a, claimedLines, weights));
      const best = sorted[0];
      if (best) {
        manualLoadout[key] = { item: best, locked: false, fallback: isFallback };
        claimLines(best, claimedLines);
        // If a 2H weapon was just chosen for Primary, clear Secondary so the
        // optimizer does not also fill it — that would be an impossible loadout.
        if (key === 'Primary' && best.twoHanded) {
          bySlot['Secondary'] = [];
          bySlotFallback['Secondary'] = [];
        }
      }
    });
  });
}
