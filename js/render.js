// ── Slot key helpers ──────────────────────────────────────────────────────────

function slotKeys(slot) {
  const cnt = MULTI_SLOTS[slot] || 1;
  return cnt > 1 ? [slot + '_0', slot + '_1'] : [slot];
}

function slotFromKey(key) {
  return key.replace(/_\d+$/, '');
}

function getSlotTier(slotKey, prefix) {
  const tiers = prefix === 'cur-' ? state.currentSlotTiers : state.slotTiers;
  return tiers[slotKey] || state.activeTier;
}

// ── Stat slider panel ─────────────────────────────────────────────────────────

function buildSliders() {
  const container = document.getElementById('stat-weights');
  container.innerHTML = '';

  STATS.forEach(s => {
    if (s.key === 'mr') {
      container.innerHTML += `<div style="border-top:1px solid var(--border);margin-top:.4rem;padding-top:.4rem"></div>`;
    }
    const w = state.weights[s.key] ?? 0;
    container.innerHTML += `<div class="stat-row" id="sr-${s.key}">
      <div class="stat-label" id="sl-${s.key}"><span id="sa-${s.key}">${s.abbr}</span>${s.label}<span id="sp-${s.key}"></span></div>
      <input class="stat-slider" id="ss-${s.key}" type="range" min="0" max="10" value="${w}"
        oninput="onSliderInput('${s.key}',+this.value)">
      <div class="stat-value" id="wv-${s.key}">${w}</div>
    </div>`;
  });

  // Haste slider
  const hw = state.weights['haste'] ?? 0;
  container.innerHTML += `<div class="stat-row" id="sr-haste" style="border-top:1px solid var(--border);margin-top:.4rem;padding-top:.4rem">
    <div class="stat-label" id="sl-haste"><span id="sa-haste" style="color:#a0c8ff">HST</span>Haste<span id="sp-haste"></span></div>
    <input class="stat-slider" id="ss-haste" type="range" min="0" max="10" value="${hw}"
      style="accent-color:#a0c8ff"
      oninput="onSliderInput('haste',+this.value)">
    <div class="stat-value" id="wv-haste" style="color:#a0c8ff">${hw}</div>
  </div>`;

  updateSliderHighlights();
}

function updateSliderHighlights() {
  const allWeights = [...STATS.map(s => state.weights[s.key] ?? 0), state.weights['haste'] ?? 0];
  const maxW = Math.max(...allWeights);
  const primaryThreshold = Math.max(7, maxW);
  const PILL_HTML = `<span style="font-family:'Cinzel',serif;font-size:.5rem;letter-spacing:.06em;padding:.05rem .3rem;border-radius:2px;background:rgba(139,105,20,.25);border:1px solid var(--gold);color:var(--gold);text-transform:uppercase;margin-left:.25rem;vertical-align:middle">primary</span>`;

  const allKeys = [...STATS.map(s => s.key), 'haste'];
  allKeys.forEach(key => {
    const w = state.weights[key] ?? 0;
    const isPrimary = w >= primaryThreshold && w > 0;
    const isHaste = key === 'haste';

    const labelEl  = document.getElementById('sl-' + key);
    const abbrEl   = document.getElementById('sa-' + key);
    const pillEl   = document.getElementById('sp-' + key);
    const valEl    = document.getElementById('wv-' + key);
    const sliderEl = document.getElementById('ss-' + key);
    if (!labelEl) return;

    if (isHaste) {
      pillEl.innerHTML = isPrimary ? PILL_HTML : '';
    } else {
      const color = isPrimary ? 'var(--gold-light)' : '';
      labelEl.style.color = color;
      abbrEl.style.color  = isPrimary ? 'var(--gold-light)' : '';
      valEl.style.color   = isPrimary ? 'var(--gold-light)' : '';
      pillEl.innerHTML    = isPrimary ? PILL_HTML : '';
      if (sliderEl) sliderEl.style.accentColor = isPrimary ? 'var(--gold)' : 'var(--border-glow)';
    }
  });
}

// ── Gear list ─────────────────────────────────────────────────────────────────

function getFiltered() {
  const fn = document.getElementById('filter-name').value.toLowerCase();
  const fs = document.getElementById('filter-slot').value;
  const fl = parseInt(document.getElementById('filter-level').value) || 999;
  return state.gear.filter(g =>
    (!fn || g.name.toLowerCase().includes(fn)) &&
    (!fs || g.slot === fs) &&
    (g.lvl <= fl)
  );
}

function renderGearList() {
  const c = document.getElementById('gear-list');
  document.getElementById('gear-count').textContent = `(${state.gear.length} items)`;
  const f = getFiltered();
  if (!state.gear.length) {
    c.innerHTML = '<div class="empty-state">No items yet. Click "Load Wiki Gear" to start.</div>';
    return;
  }
  if (!f.length) {
    c.innerHTML = '<div class="empty-state">No items match the filter.</div>';
    return;
  }
  c.innerHTML = f.map(g => {
    const ss = STATS.filter(s => g.stats?.[s.key] > 0).map(s => `${s.abbr}+${g.stats[s.key]}`).join(' ');
    const tag = g.source === 'wiki'
      ? '<span class="tag tag-wiki">wiki</span>'
      : '<span class="tag tag-manual">custom</span>';
    return `<div class="gear-item" draggable="true" data-id="${g.id}" ondragstart="onItemDragStart(event,${g.id})">
      <span class="gear-item-name">${g.name}${tag}</span>
      <span class="gear-item-slot">Lv${g.lvl}·${g.slot}</span>
      <span class="gear-item-stats">${ss || '—'}</span>
      <button class="btn btn-red" onclick="removeItem(${g.id})">✕</button>
    </div>`;
  }).join('');
}

// ── Efficiency bar ────────────────────────────────────────────────────────────

function effBar(totalScore, maxScore) {
  if (!maxScore || !totalScore) return '';
  const pct = Math.min(100, (totalScore / maxScore) * 100);
  const color = pct >= 90 ? '#c9b44a' : pct >= 70 ? '#7fba5a' : pct >= 50 ? '#5a9ecc' : '#888';
  const label = pct >= 95 ? 'Near Perfect' : pct >= 85 ? 'Excellent' : pct >= 70 ? 'Strong' : pct >= 50 ? 'Decent' : 'Room to Improve';
  return `<div style="margin-top:.9rem;padding-top:.9rem;border-top:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.35rem">
      <span style="font-family:'Cinzel',serif;font-size:.65rem;letter-spacing:.12em;color:var(--text-dim);text-transform:uppercase">Priority Efficiency</span>
      <span style="font-size:.78rem;color:${color};font-weight:600">${label} &nbsp;·&nbsp; ${pct.toFixed(1)}%
        <span style="color:var(--text-dim);font-weight:400;font-size:.72rem">(${totalScore.toFixed(0)} / ${maxScore.toFixed(0)})</span>
      </span>
    </div>
    <div style="height:6px;background:var(--surface3,#1a1a1a);border-radius:3px;overflow:hidden;border:1px solid var(--border)">
      <div style="height:100%;width:${pct.toFixed(1)}%;background:linear-gradient(90deg,${color}88,${color});border-radius:3px;transition:width .4s ease"></div>
    </div>
    <div style="font-size:.7rem;color:var(--text-dim);margin-top:.3rem">% of the highest-scoring gear available to your class at this level &amp; quality tier</div>
  </div>`;
}

// ── Slot grid sub-renderers ───────────────────────────────────────────────────

function renderTierBadge(key, prefix, item) {
  if (!item) return '';
  const t = getSlotTier(key, prefix);
  const label = t === 'base' ? 'Base' : t === 'blessed' ? '✦ Blessed' : '✦✦ Godly';
  const col = t === 'base' ? 'var(--text-dim)' : t === 'blessed' ? 'var(--gold)' : '#e080ff';
  const bg  = t === 'base' ? 'transparent' : t === 'blessed' ? 'rgba(139,105,20,.15)' : 'rgba(180,80,255,.12)';
  return `<button onclick="cycleSlotTier('${key}','${prefix}')" title="Click to cycle quality: Base → Blessed → Godly" onmouseover="this.style.filter='brightness(1.4)'" onmouseout="this.style.filter=''" style="font-family:'Cinzel',serif;font-size:.55rem;letter-spacing:.06em;padding:.1rem .35rem;border-radius:2px;border:1px solid ${col};background:${bg};color:${col};cursor:pointer;white-space:nowrap;line-height:1.4;transition:filter .15s">${label} ↻</button>`;
}

function renderLockBtn(prefix, key, locked) {
  return `<button class="lock-btn ${locked ? 'locked' : ''}" onclick="toggleLockIn('${prefix}','${key}')" title="${locked ? 'Unlock' : 'Lock'}">${locked ? '🔒' : '🔓'}</button>`;
}

function renderSourceHtml(item) {
  if (!item) return '';
  const si = item.source_info;
  if (!si) return '';
  let icon, label;
  if (si.type === 'craftable') {
    icon = '🔨'; label = 'crafted';
  } else if (si.type === 'vendor') {
    icon = '🛒'; label = si.name;
  } else if (si.type === 'quest') {
    icon = '📜'; label = si.name;
  } else {
    icon = '⚔'; label = si.monster;
  }
  return `<div style="font-size:.68rem;color:var(--text-dim);margin-top:.25rem;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${label}">${icon} ${label}</div>`;
}

function renderSlotContent(slot, slotKey, item, loadout, showSource) {
  if (!item) {
    const pri = loadout['Primary']?.item;
    if (slot === 'Secondary' && pri?.twoHanded) {
      return `<div class="result-empty" style="font-size:.72rem;text-align:center;padding:.4rem 0;opacity:.4;font-style:italic">2H equipped</div>`;
    }
    return `<div class="result-empty" style="font-size:.75rem;text-align:center;padding:.4rem 0;opacity:.5">click to equip</div>`;
  }
  return `<div class="result-item-name">${item.name}</div>
    <div class="result-item-stats">${STATS.filter(s => item.stats?.[s.key] > 0).map(s => `${s.abbr}+${item.stats[s.key]}`).join('·') || '—'}</div>
    ${showSource ? renderSourceHtml(item) : ''}`;
}

// ── Slot grid ─────────────────────────────────────────────────────────────────

function renderSlotGrid(loadout, opts = {}) {
  const { showLock = true, showTier = true, showSource = true, prefix = '' } = opts;
  const totals = {};
  STATS.forEach(s => totals[s.key] = 0);
  let totalScore = 0;

  const slotHtml = SLOTS.map(slot => {
    const keys = slotKeys(slot);
    return keys.map((key, ki) => {
      const entry  = loadout[key];
      const item   = entry ? entry.item : null;
      const locked = entry ? entry.locked : false;
      if (item) {
        STATS.forEach(s => totals[s.key] += (item.stats?.[s.key] || 0));
        totalScore += score(item, state.weights);
      }
      const slotClass = ['result-slot', item ? 'equipped' : '', locked ? 'locked' : ''].filter(Boolean).join(' ');
      const slotLabel = keys.length > 1 ? slot + ' ' + (ki + 1) : slot;
      const domId = `slot-${prefix}${key}`;

      const headerBtns = item ? `<div style="display:flex;gap:.25rem;align-items:center">
        ${showTier ? renderTierBadge(key, prefix, item) : ''}
        ${showLock ? renderLockBtn(prefix, key, locked) : ''}
        <button class="clear-slot-btn" onclick="clearSlotIn('${prefix}','${key}')" title="Remove">✕</button>
      </div>` : '';

      return `<div class="${slotClass}" id="${domId}"
        onclick="onSlotClickIn(event,'${prefix}','${key}')"
        ondragover="onSlotDragOver(event,'${key}')"
        ondragleave="onSlotDragLeave('${key}')"
        ondrop="onSlotDropIn(event,'${prefix}','${key}')">
        <div class="result-slot-header"><div class="result-slot-name">${slotLabel}</div>${headerBtns}</div>
        ${renderSlotContent(slot, key, item, loadout, showSource)}
      </div>`;
    }).join('');
  }).join('');

  return { slotHtml, totals, totalScore };
}

// ── Effects panel ─────────────────────────────────────────────────────────────

function fmtEffect(v) {
  return typeof v === 'number' ? v.toFixed(1).replace(/\.0$/, '') : v;
}

function renderEffectPill(label, val, procVal, unit, color) {
  color = color || 'var(--blue-light)';
  unit  = unit  || '';
  const procLine = procVal > 0
    ? `<span style="font-size:.65rem;color:var(--text-dim)">▪ ${fmtEffect(procVal)}${unit} proc</span>`
    : '';
  const totalLine = val > 0
    ? `<span style="font-family:'Cinzel',serif;font-size:.95rem;color:${color};font-weight:600">+${fmtEffect(val)}${unit}</span>`
    : `<span style="font-family:'Cinzel',serif;font-size:.95rem;color:var(--text-dim);font-weight:600">—</span>`;
  return `<div style="display:flex;flex-direction:column;gap:.1rem">
    <span style="font-family:'Cinzel',serif;font-size:.6rem;color:var(--text-dim);letter-spacing:.06em">${label}</span>
    ${totalLine}
    ${procLine}
  </div>`;
}

function renderProcPill(label, proc, color) {
  const dmg    = proc.target_damage  || 0;
  const heal   = proc.target_healing || 0;
  const val    = dmg || heal;
  const kind   = dmg ? 'dmg' : 'heal';
  const chance = proc.chance || 0;
  return `<div style="display:flex;flex-direction:column;gap:.1rem">
    <span style="font-family:'Cinzel',serif;font-size:.6rem;color:var(--text-dim);letter-spacing:.06em">${label}</span>
    <span style="font-family:'Cinzel',serif;font-size:.95rem;color:${color};font-weight:600">${val} ${kind}</span>
    <span style="font-size:.65rem;color:var(--text-dim)">@ ${chance}% chance</span>
  </div>`;
}

function renderHastePill(fx) {
  if (fx.haste <= 0 && fx.haste_proc <= 0) return '';
  const color = fx.haste >= 55 ? '#ff9944' : fx.haste >= 30 ? '#a0c8ff' : 'var(--blue-light)';
  const total = fx.haste > 0
    ? `<span style="font-family:'Cinzel',serif;font-size:.95rem;color:${color};font-weight:600">+${fmtEffect(fx.haste)}%</span>`
    : `<span style="font-family:'Cinzel',serif;font-size:.95rem;color:var(--text-dim);font-weight:600">—</span>`;
  return `<div style="display:flex;flex-direction:column;gap:.1rem">
    <span style="font-family:'Cinzel',serif;font-size:.6rem;color:var(--text-dim);letter-spacing:.06em">HASTE</span>
    ${total}
    <span style="font-size:.65rem;color:var(--text-dim)">
      ${fx.haste_worn > 0 ? `<span style="color:#a0c8ff">▪ ${fmtEffect(fx.haste_worn)}% worn</span>` : ''}
      ${fx.haste_aura > 0 ? `<span style="color:#c0a0ff;margin-left:.3rem">▪ ${fmtEffect(fx.haste_aura)}% aura</span>` : ''}
      ${fx.haste_proc > 0 ? `<span style="color:var(--text-dim);margin-left:.3rem">▪ ${fmtEffect(fx.haste_proc)}% proc</span>` : ''}
    </span>
  </div>`;
}

function renderEffectsPanel(fx) {
  const hasHaste     = fx.haste > 0     || fx.haste_proc > 0;
  const hasLifesteal = fx.lifesteal > 0 || fx.lifesteal_proc > 0;
  const hasAtkroll   = fx.atkroll > 0   || fx.atkroll_proc > 0;
  const hasMovespeed = fx.movespeed > 0 || fx.movespeed_proc > 0;
  const hasWandProc  = !!fx.wand_proc;
  const hasBowProc   = !!fx.bow_proc;
  if (!hasHaste && !hasLifesteal && !hasAtkroll && !hasMovespeed && !hasWandProc && !hasBowProc) return '';

  const conflicts = fx.lineConflicts.length
    ? `<div style="margin-top:.5rem;font-size:.68rem;color:var(--text-dim);border-top:1px solid var(--border);padding-top:.4rem">${
        fx.lineConflicts.map(c =>
          `<div>&#9888; <span style="color:var(--red-light)">${c.itemName}</span>: ${c.line} blocked by <span style="color:var(--text-bright)">${c.blockedBy}</span></div>`
        ).join('')
      }</div>`
    : '';

  return `<div style="margin-top:.75rem;padding:.65rem .9rem;background:var(--surface2);border:1px solid var(--border);border-radius:3px;border-left:2px solid var(--blue-light)">
    <div style="font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:.12em;color:var(--text-dim);text-transform:uppercase;margin-bottom:.5rem">Spell &amp; Passive Effects</div>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem 1.5rem">
      ${renderHastePill(fx)}
      ${hasLifesteal ? renderEffectPill('LIFESTEAL', fx.lifesteal, fx.lifesteal_proc, '%', '#e08080') : ''}
      ${hasAtkroll   ? renderEffectPill('ATK ROLL',  fx.atkroll,   fx.atkroll_proc,   '',  '#c9a227') : ''}
      ${hasMovespeed ? renderEffectPill('MOVE SPD',  fx.movespeed, fx.movespeed_proc, '%', '#80e0a0') : ''}
      ${hasWandProc  ? renderProcPill('WAND PROC', fx.wand_proc, '#c0a0ff') : ''}
      ${hasBowProc   ? renderProcPill('BOW PROC',  fx.bow_proc,  '#a0d0a0') : ''}
    </div>
    ${conflicts}
  </div>`;
}

// ── Loadout panels ────────────────────────────────────────────────────────────

// deltaTotals: stat totals from the other panel for ▲/▼ comparison, or null.
function renderStatTotals(totals, deltaTotals) {
  return STATS.map(s => {
    const val   = totals[s.key] || 0;
    const delta = deltaTotals ? val - (deltaTotals[s.key] || 0) : 0;
    const isNeg = val < 0;
    const color = isNeg ? 'var(--red-light)' : val > 0 ? 'var(--text-bright)' : 'var(--text-dim)';
    const deltaHtml = deltaTotals && delta !== 0
      ? `<span style="font-size:.6rem;font-family:'Cinzel',serif;color:${delta > 0 ? 'var(--green-light)' : 'var(--red-light)'};display:block;line-height:1">${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}</span>`
      : '';
    return `<div class="stat-total">
      <span class="stat-total-name" style="font-size:.65rem">${s.abbr}</span>
      <span class="stat-total-val" style="color:${color};font-size:${Math.min(1.1, 0.7 + val / 80)}rem">${isNeg ? '' : val > 0 ? '+' : ''}${val}</span>
      ${deltaHtml}
    </div>`;
  }).join('');
}

function renderCurrentGear() {
  const { slotHtml, totals, totalScore } = renderSlotGrid(state.currentLoadout, { showLock: false, showTier: true, showSource: false, prefix: 'cur-' });
  state.loadoutScores.current = totalScore;
  const filledCount = Object.keys(state.currentLoadout).length;

  document.getElementById('current-gear-panel').innerHTML = `<div class="panel">
    <div class="panel-header"><h2>Current Gear</h2></div>
    <div class="panel-body">
      <div class="loadout-controls">
        <button class="btn btn-ghost" onclick="clearCurrentLoadout()" style="font-size:.75rem;padding:.4rem .9rem;color:var(--red-light);border-color:var(--red)">✕ Clear All</button>
        <span style="font-size:.78rem;color:var(--text-dim);font-style:italic">${filledCount > 0 ? `${filledCount} slots filled` : 'Click a slot to set your current gear'}</span>
      </div>
      <div class="score-bar">
        <div style="display:flex;flex-direction:column;gap:.15rem;min-width:80px">
          <div class="score-label">Priority Score</div>
          <div class="score-value">${totalScore.toFixed(1)}</div>
        </div>
        <div style="width:1px;background:var(--border);align-self:stretch;margin:0 .5rem"></div>
        <div style="display:flex;flex-wrap:wrap;gap:.6rem 1.2rem;flex:1">
          ${renderStatTotals(totals, null)}
        </div>
      </div>
      <div style="margin-top:1rem"><div class="result-grid">${slotHtml}</div></div>
    </div>
  </div>`;
}

function renderManualLoadout() {
  const { slotHtml, totals, totalScore } = renderSlotGrid(state.manualLoadout, { showLock: true, showTier: true, showSource: true, prefix: '' });
  state.loadoutScores.builder = totalScore;

  const curTotals = {};
  STATS.forEach(s => curTotals[s.key] = 0);
  const hasCurrent = Object.keys(state.currentLoadout).length > 0;
  if (hasCurrent) {
    SLOTS.forEach(slot => slotKeys(slot).forEach(key => {
      const item = state.currentLoadout[key]?.item;
      if (item) STATS.forEach(s => curTotals[s.key] += (item.stats?.[s.key] || 0));
    }));
  }

  const fl = parseInt(document.getElementById('filter-level').value) || 999;
  const maxScore = computeMaxScore(state.gear, state.activeTier, state.weights, fl);
  const fx = sumLoadoutEffects(state.manualLoadout);
  const tierLabel = state.activeTier === 'base' ? ''
    : state.activeTier === 'blessed'
      ? ' <span style="color:var(--gold);font-size:.75rem">✦ Blessed</span>'
      : ' <span style="color:#e080ff;font-size:.75rem;text-shadow:0 0 8px rgba(200,100,255,.4)">✦✦ Godly</span>';
  const filledCount = Object.keys(state.manualLoadout).length;
  const lockedCount = Object.values(state.manualLoadout).filter(e => e.locked).length;

  document.getElementById('loadout-builder-panel').innerHTML = `<div class="panel">
    <div class="panel-header"><h2>${state.activeClass} — Loadout Builder${tierLabel}</h2></div>
    <div class="panel-body">
      <div class="loadout-controls">
        <button class="btn btn-gold" onclick="runOptimize()" style="font-size:.78rem;padding:.4rem 1rem">⚔ Auto-Fill Empty Slots</button>
        <button class="btn btn-ghost" onclick="clearManualLoadout()" style="font-size:.75rem;padding:.4rem .9rem;color:var(--red-light);border-color:var(--red)">✕ Clear All</button>
        <span style="font-size:.78rem;color:var(--text-dim);font-style:italic">${filledCount > 0 ? `${filledCount} filled · ${lockedCount} locked` : 'Click a slot or drag items from the database'}</span>
      </div>
      <div class="score-bar">
        <div style="display:flex;flex-direction:column;gap:.15rem;min-width:80px">
          <div class="score-label">Priority Score</div>
          <div class="score-value">${totalScore.toFixed(1)}</div>
        </div>
        <div style="width:1px;background:var(--border);align-self:stretch;margin:0 .5rem"></div>
        <div style="display:flex;flex-wrap:wrap;gap:.6rem 1.2rem;flex:1">
          ${renderStatTotals(totals, hasCurrent ? curTotals : null)}
        </div>
      </div>
      ${effBar(totalScore, maxScore)}
      ${renderEffectsPanel(fx)}
      <div style="margin-top:1rem"><div class="result-grid">${slotHtml}</div></div>
    </div>
  </div>`;
}

function renderBothLoadouts() {
  renderCurrentGear();
  renderManualLoadout();
  renderComparisonBar();
}

function renderComparisonBar() {
  const el = document.getElementById('comparison-bar');
  const curScore = state.loadoutScores.current;
  const bldScore = state.loadoutScores.builder;
  const hasCurrent = Object.keys(state.currentLoadout).length > 0;
  const hasBuilder = Object.keys(state.manualLoadout).length > 0;

  if (!hasCurrent || !hasBuilder) {
    el.innerHTML = '';
    return;
  }

  const delta  = bldScore - curScore;
  const pct    = curScore > 0 ? (delta / curScore) * 100 : 0;
  const isFlat = Math.abs(delta) < 0.05;
  const isUpgrade = !isFlat && delta > 0;

  const color    = isFlat ? 'var(--text-dim)' : isUpgrade ? 'var(--green-light)' : 'var(--red-light)';
  const barColor = isFlat ? 'var(--border-glow)' : isUpgrade ? '#4aaa4a' : '#c94444';
  const label    = isFlat ? 'No change vs current gear'
    : isUpgrade ? 'Upgrade over current gear'
    : 'Downgrade vs current gear';
  const sign = delta >= 0 ? '+' : '';
  const barW = isFlat ? 50 : isUpgrade
    ? Math.min(100, 50 + (pct / 2))
    : Math.max(0, 50 - (Math.abs(pct) / 2));

  el.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:.9rem 1.2rem">
    <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.6rem">
      <span style="font-family:'Cinzel',serif;font-size:.7rem;letter-spacing:.12em;color:var(--text-dim);text-transform:uppercase">Loadout Comparison</span>
      <div style="display:flex;align-items:baseline;gap:1rem;flex-wrap:wrap">
        <span style="font-size:.82rem;color:var(--text-dim)">Current: <strong style="color:var(--text-bright);font-family:'Cinzel',serif">${curScore.toFixed(1)}</strong></span>
        <span style="font-size:.82rem;color:var(--text-dim)">Builder: <strong style="color:var(--text-bright);font-family:'Cinzel',serif">${bldScore.toFixed(1)}</strong></span>
        <span style="font-family:'Cinzel',serif;font-size:.95rem;font-weight:700;color:${color}">${sign}${delta.toFixed(1)} &nbsp;·&nbsp; ${sign}${pct.toFixed(1)}%</span>
      </div>
    </div>
    <div style="position:relative;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;border:1px solid var(--border)">
      <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--border-glow);z-index:1"></div>
      <div style="position:absolute;top:0;bottom:0;transition:left .4s ease,width .4s ease;border-radius:4px;background:linear-gradient(90deg,${barColor}88,${barColor});
        ${isUpgrade ? `left:50%;width:${(barW - 50).toFixed(1)}%` : isFlat ? 'left:49%;width:2%' : `left:${barW.toFixed(1)}%;width:${(50 - barW).toFixed(1)}%`}"></div>
    </div>
    <div style="font-size:.72rem;color:${color};margin-top:.35rem;font-style:italic">${label}</div>
  </div>`;
}
