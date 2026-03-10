function sumLoadoutEffects(loadout) {
  const out = {
    haste:0, haste_worn:0, haste_aura:0, haste_proc:0,
    lifesteal:0, lifesteal_proc:0,
    atkroll:0,   atkroll_proc:0,
    movespeed:0, movespeed_proc:0,
    wand_proc:null, bow_proc:null,
    lineConflicts: [], // [{itemName, line, blockedBy}] for warning display
  };

  // First pass: determine the highest req_lvl winner per spell line across
  // all equipped items. This mirrors the game's one-per-line rule.
  const lineWinner = {}; // line → { item, req_lvl }
  Object.values(loadout).forEach(entry => {
    if (!entry?.item) return;
    const e = entry.item.effects || {};
    for (const bucket of [e.worn, e.aura]) {
      if (!bucket?.line) continue;
      const lvl = bucket.req_lvl ?? -1;
      const prev = lineWinner[bucket.line];
      if (!prev || lvl > prev.req_lvl) {
        lineWinner[bucket.line] = { item: entry.item, req_lvl: lvl };
      }
    }
  });

  // Second pass: sum only the winning item's contribution per line, and collect
  // info about blocked items for the conflict warning UI.
  Object.values(loadout).forEach(entry => {
    if (!entry?.item) return;
    const item = entry.item;
    const e = item.effects || {};

    const wornBlocked = e.worn?.line && lineWinner[e.worn.line]?.item !== item;
    const auraBlocked = e.aura?.line && lineWinner[e.aura.line]?.item !== item;

    if (wornBlocked) {
      out.lineConflicts.push({
        itemName: item.name,
        line: e.worn.line,
        blockedBy: lineWinner[e.worn.line].item.name,
      });
    }
    if (auraBlocked) {
      out.lineConflicts.push({
        itemName: item.name,
        line: e.aura.line,
        blockedBy: lineWinner[e.aura.line].item.name,
      });
    }

    // Build a context that blocks the losing buckets so getItemPermEffects
    // returns zero for them.
    const blockedContext = {
      worn: wornBlocked ? {} : (e.worn || {}),
      aura: auraBlocked ? {} : (e.aura || {}),
      proc: e.proc || {},
    };
    const perm = getItemPermEffects({ effects: blockedContext });

    out.haste     += perm.haste;
    out.lifesteal += perm.lifesteal;
    out.atkroll   += perm.atkroll;
    out.movespeed += perm.movespeed;
    // Raw proc values for display sub-labels
    out.haste_proc     += perm.haste_proc;
    out.lifesteal_proc += perm.lifesteal_proc;
    out.atkroll_proc   += perm.atkroll_proc;
    out.movespeed_proc += perm.movespeed_proc;
    // Haste breakdown sub-labels need raw bucket access
    if (!wornBlocked) out.haste_worn += (e.worn?.haste || 0);
    if (!auraBlocked) out.haste_aura += (e.aura?.haste || 0);
    // Only one wand/bow can be equipped — last item wins (shouldn't conflict)
    if (e.wand_proc) out.wand_proc = e.wand_proc;
    if (e.bow_proc)  out.bow_proc  = e.bow_proc;
  });
  return out;
}
