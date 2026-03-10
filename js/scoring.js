// Returns spell-effect totals for scoring. Worn and aura are always-on;
// proc effects are discounted at 50% to approximate uptime. Spell-sourced
// resists (mr/er/pr/vr) are separate from item.stats resists — both feed
// into score() but via different paths (item.stats via STAT_KEYS direct
// reduce; spell effects via STATS.forEach on the return value here).
function getItemEffects(item) {
  const e = item.effects || {};
  const w = e.worn || {}, a = e.aura || {}, p = e.proc || {};
  return {
    haste:     (w.haste||0)     + (a.haste||0)     + (p.haste||0)*0.5,
    lifesteal: (w.lifesteal||0) + (a.lifesteal||0) + (p.lifesteal||0)*0.5,
    atkroll:   (w.atkroll||0)   + (a.atkroll||0)   + (p.atkroll||0)*0.5,
    movespeed: (w.movespeed||0) + (a.movespeed||0),
    mr: (w.mr||0) + (a.mr||0) + (p.mr||0)*0.5,
    er: (w.er||0) + (a.er||0) + (p.er||0)*0.5,
    pr: (w.pr||0) + (a.pr||0) + (p.pr||0)*0.5,
    vr: (w.vr||0) + (a.vr||0) + (p.vr||0)*0.5,
    // Worn + aura stats score via STATS.forEach in score()
    str: (w.str||0) + (a.str||0), dex: (w.dex||0) + (a.dex||0),
    agi: (w.agi||0) + (a.agi||0), end: (w.end||0) + (a.end||0),
    int: (w.int||0) + (a.int||0), wis: (w.wis||0) + (a.wis||0),
    cha: (w.cha||0) + (a.cha||0),
  };
}

// Returns permanent-only (worn + aura) spell-effect totals for display.
// Proc effects are intentionally excluded from totals — they are temporary
// and would misrepresent what the player permanently has. Raw proc values
// are exposed separately for display as sub-labels.
function getItemPermEffects(item) {
  const e = item.effects || {};
  const w = e.worn || {}, a = e.aura || {}, p = e.proc || {};
  return {
    haste:     (w.haste||0)     + (a.haste||0),
    lifesteal: (w.lifesteal||0) + (a.lifesteal||0),
    atkroll:   (w.atkroll||0)   + (a.atkroll||0),
    movespeed: (w.movespeed||0) + (a.movespeed||0),
    mr: (w.mr||0) + (a.mr||0),
    er: (w.er||0) + (a.er||0),
    pr: (w.pr||0) + (a.pr||0),
    vr: (w.vr||0) + (a.vr||0),
    // Raw proc values for display as sub-labels (not discounted)
    haste_proc:     p.haste     || 0,
    lifesteal_proc: p.lifesteal || 0,
    atkroll_proc:   p.atkroll   || 0,
    movespeed_proc: p.movespeed || 0,
    mr_proc: p.mr || 0, er_proc: p.er || 0,
    pr_proc: p.pr || 0, vr_proc: p.vr || 0,
  };
}

// Returns true if the given effect bucket (worn or aura sub-object) is blocked
// by an already-claimed spell line. An effect is blocked when its line is
// claimed at an equal-or-higher required level (matching the game's
// CheckForHigherLevelSE logic, which uses strict > for blocking but the
// overwrite loop uses >= — the net effect on a fully-built loadout is that
// only the highest-level effect per line ever applies).
function effectBlocked(effect, claimedLines) {
  const line = effect?.line;
  if (!line) return false; // Generic or no line — never blocked
  const claimed = claimedLines[line];
  if (claimed === undefined) return false;
  return claimed >= (effect.req_lvl ?? -1);
}

// Update claimedLines after placing an item. Worn and aura effects each claim
// their spell line at their required level, but only if they are stronger than
// whatever is already claimed (higher required level wins).
function claimLines(item, claimedLines) {
  const e = item.effects || {};
  for (const bucket of [e.worn, e.aura]) {
    if (!bucket?.line) continue;
    const existing = claimedLines[bucket.line];
    const lvl = bucket.req_lvl ?? -1;
    if (existing === undefined || lvl > existing) {
      claimedLines[bucket.line] = lvl;
    }
  }
}

function score(item, weights) {
  if (!item?.stats) return 0;
  let s = STATS.reduce((a,s) => a+(item.stats[s.key]||0)*weights[s.key], 0);
  // Add haste bonus + aura stat bonuses to scoring
  const effs = getItemEffects(item);
  s += effs.haste * (weights['haste'] || 0);
  // Aura items grant stats via their spell — include these in scoring
  STATS.forEach(st => { s += (effs[st.key] || 0) * (weights[st.key] || 0); });
  return s;
}

// Score an item in the context of an already-partially-built loadout. Any worn
// or aura effect whose spell line is already claimed at an equal-or-higher
// level is excluded from the score because the game engine would block it.
// Calls getItemEffects on context-filtered buckets to avoid duplicating the
// accumulation logic.
function scoreInContext(item, claimedLines, weights) {
  if (!item?.stats) return 0;
  let s = STATS.reduce((a, st) => a + (item.stats[st.key] || 0) * weights[st.key], 0);
  const e = item.effects || {};
  const filteredItem = {
    effects: {
      worn: effectBlocked(e.worn, claimedLines) ? {} : (e.worn || {}),
      aura: effectBlocked(e.aura, claimedLines) ? {} : (e.aura || {}),
      proc: e.proc || {},
    },
  };
  const effs = getItemEffects(filteredItem);
  s += effs.haste * (weights['haste'] || 0);
  STATS.forEach(st => { s += (effs[st.key] || 0) * (weights[st.key] || 0); });
  return s;
}
