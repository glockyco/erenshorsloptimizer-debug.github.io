// CLASSES, STATS, SLOTS, MULTI_SLOTS are defined in js/data.js
// getItemEffects, getItemPermEffects, effectBlocked, claimLines,
// score, scoreInContext are defined in js/scoring.js
// sumLoadoutEffects is defined in js/effects.js
// bankersRound, applyTier, blessedItem, optimize, computeMaxScore
// are defined in js/optimizer.js
// state is defined in js/state.js
// slotKeys, slotFromKey, getSlotTier, buildSliders, updateSliderHighlights,
// renderGearList, effBar, renderSlotGrid, renderCurrentGear,
// renderManualLoadout, renderBothLoadouts, renderComparisonBar
// are defined in js/render.js

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Build class buttons
  const bar = document.getElementById('class-bar');
  Object.keys(CLASSES).forEach(cls => {
    const btn = document.createElement('button');
    btn.className = 'class-btn' + (cls === state.activeClass ? ' active' : '');
    btn.innerHTML = `${CLASSES[cls].icon} ${cls}`;
    btn.onclick = () => switchClass(cls);
    bar.appendChild(btn);
  });

  // Build stat sliders
  buildSliders();

  // Build stat inputs in add-form
  const si = document.getElementById('stat-inputs');
  STATS.forEach(s => {
    si.innerHTML += `<div class="form-field"><label>${s.abbr}</label><input type="number" id="si-${s.key}" placeholder="0" min="0"></div>`;
  });

  switchClass('Windblade', true);
  loadWikiGear();
  renderBothLoadouts();
}

function onSliderInput(key, val) {
  state.weights[key] = val;
  document.getElementById('wv-' + key).textContent = val;
  updateSliderHighlights();
}

function switchClass(cls, initial=false) {
  state.activeClass = cls;
  // Update buttons
  document.querySelectorAll('.class-btn').forEach((b,i) => {
    b.classList.toggle('active', Object.keys(CLASSES)[i] === cls);
  });
  // Update description
  document.getElementById('class-desc').textContent = `${CLASSES[cls].icon}  ${cls} — ${CLASSES[cls].desc}`;
  // Reset weights to class defaults
  state.weights = {...CLASSES[cls].weights};
  buildSliders();
  // Reload gear for new class (keep manual items, replace wiki items)
  if (!initial) {
    state.gear = state.gear.filter(g => g.source === 'manual');
    state.wikiGear.forEach(item => {
      if (item.classes.includes(cls)) state.gear.push({...item, source:'wiki', id: Date.now()+Math.random()});
    });
  }
  renderGearList();
  // Clear manual loadout and re-render builder for new class
  Object.keys(state.manualLoadout).forEach(k => delete state.manualLoadout[k]);
  renderBothLoadouts();
}

function resetWeights() {
  state.weights = {...CLASSES[state.activeClass].weights};
  buildSliders();
}

// ── Gear management ───────────────────────────────────────────────────────────
function addItemManual() {
  const name = document.getElementById('item-name').value.trim();
  if (!name) {
    const inp = document.getElementById('item-name');
    inp.style.borderColor = 'var(--red-light)';
    inp.placeholder = 'Name required!';
    inp.focus();
    const clear = () => { inp.style.borderColor = ''; inp.placeholder = 'Name'; inp.removeEventListener('input', clear); };
    inp.addEventListener('input', clear);
    return;
  }
  const slot = document.getElementById('item-slot').value, lvl = parseInt(document.getElementById('item-level').value)||1;
  const stats = {}; STATS.forEach(s => { stats[s.key] = parseInt(document.getElementById('si-'+s.key).value)||0; });
  state.gear.push({name, slot, lvl, stats, source:'manual', classes:[state.activeClass], id:Date.now()+Math.random()});
  clearForm(); renderGearList();
}

function clearForm() {
  document.getElementById('item-name').value=''; document.getElementById('item-level').value='';
  STATS.forEach(s => { const e=document.getElementById('si-'+s.key); if(e) e.value=''; });
}

function removeItem(id) { state.gear=state.gear.filter(g=>g.id!==id); renderGearList(); }

function loadWikiGear() {
  const ex = new Set(state.gear.map(g=>g.name.toLowerCase())); let added=0;
  state.wikiGear.forEach(item => {
    if (item.classes.includes(state.activeClass) && !ex.has(item.name.toLowerCase())) {
      state.gear.push({...item, source:'wiki', id:Date.now()+Math.random()}); added++;
    }
  });
  renderGearList();
  if (!added) alert(`All wiki items for ${state.activeClass} are already loaded.`);
}

function clearAllGear() {
  if (state.gear.length && confirm('Remove all items from the database?')) {
    state.gear = [];
    renderGearList();
    renderBothLoadouts();
  }
}

function getFiltered() {
  const fn=document.getElementById('filter-name').value.toLowerCase(),
    fs=document.getElementById('filter-slot').value,
    fl=parseInt(document.getElementById('filter-level').value)||999;
  return state.gear.filter(g=>(!fn||g.name.toLowerCase().includes(fn))&&(!fs||g.slot===fs)&&(g.lvl<=fl));
}

// ── Manual Loadout ────────────────────────────────────────────────────────────

function onItemDragStart(e, id) {
  state.dragItemId = id;
  e.dataTransfer.effectAllowed = 'copy';
  setTimeout(() => {
    const el = document.querySelector(`.gear-item[data-id="${id}"]`);
    if (el) el.classList.add('dragging');
  }, 0);
}

document.addEventListener('dragend', () => {
  document.querySelectorAll('.gear-item.dragging').forEach(el => el.classList.remove('dragging'));
});

function onSlotDragOver(e, slotKey) {
  e.preventDefault();
  const el = document.getElementById('slot-'+slotKey);
  if (el) el.classList.add('drag-over');
}

function onSlotDragLeave(slotKey) {
  const el = document.getElementById('slot-'+slotKey);
  if (el) el.classList.remove('drag-over');
}

function onSlotDrop(e, slotKey) {
  e.preventDefault();
  const el = document.getElementById('slot-'+slotKey);
  if (el) el.classList.remove('drag-over');
  if (state.dragItemId === null) return;
  const item = state.gear.find(g => g.id === state.dragItemId);
  if (!item) return;
  const targetSlot = slotFromKey(slotKey);
  const primaryItem = state.manualLoadout['Primary']?.item;
  const secondaryBlocked = primaryItem?.twoHanded && targetSlot === 'Secondary';
  const slotOk = !secondaryBlocked && (item.slot === targetSlot || (item.bothSlots && (targetSlot === 'Primary' || targetSlot === 'Secondary')));
  if (!slotOk) {
    if (el) {
      el.classList.add('drag-reject');
      setTimeout(() => el.classList.remove('drag-reject'), 400);
    }
    return;
  }
  // If dropping a 2H into Primary, clear Secondary
  if (slotKey === 'Primary' && item.twoHanded) {
    delete state.manualLoadout['Secondary'];
    delete state.slotTiers['Secondary'];
  }
  state.manualLoadout[slotKey] = { item: blessedItem(item, state.activeTier), locked: true };
  state.dragItemId = null;
  renderBothLoadouts();
}

function toggleLock(slotKey) {
  if (state.manualLoadout[slotKey]) {
    state.manualLoadout[slotKey].locked = !state.manualLoadout[slotKey].locked;
    renderBothLoadouts();
  }
}

function clearSlot(slotKey) {
  delete state.manualLoadout[slotKey];
  delete state.slotTiers[slotKey];
  renderBothLoadouts();
}

function clearManualLoadout() {
  Object.keys(state.manualLoadout).forEach(k => delete state.manualLoadout[k]);
  Object.keys(state.slotTiers).forEach(k => delete state.slotTiers[k]);
  renderBothLoadouts();
}



// ── Current Gear loadout ──────────────────────────────────────────────────────

function clearCurrentLoadout() {
  Object.keys(state.currentLoadout).forEach(k => delete state.currentLoadout[k]);
  Object.keys(state.currentSlotTiers).forEach(k => delete state.currentSlotTiers[k]);
  renderBothLoadouts();
}

// ── Slot interaction helpers (prefix-aware) ───────────────────────────────────
function getLoadoutByPrefix(prefix) {
  return prefix === 'cur-' ? state.currentLoadout : state.manualLoadout;
}

function onSlotClickIn(e, prefix, key) {
  if (e.target.closest('button')) return;
  state.modalTargetSlot = key;
  state.modalTargetPrefix = prefix;
  openSlotModal(key);
}

function clearSlotIn(prefix, key) {
  const loadout = getLoadoutByPrefix(prefix);
  delete loadout[key];
  if (prefix === 'cur-') delete state.currentSlotTiers[key];
  else delete state.slotTiers[key];
  renderBothLoadouts();
}

function toggleLockIn(prefix, key) {
  const loadout = getLoadoutByPrefix(prefix);
  if (loadout[key]) { loadout[key].locked = !loadout[key].locked; renderBothLoadouts(); }
}

function onSlotDropIn(e, prefix, key) {
  onSlotDrop(e, key); // drag-drop only applies to builder
}
// ── Item Quality / Blessing ──────────────────────────────────────────────────

function cycleSlotTier(slotKey, prefix) {
  prefix = prefix || '';
  const tiers = prefix === 'cur-' ? state.currentSlotTiers : state.slotTiers;
  const loadout = getLoadoutByPrefix(prefix);
  const current = getSlotTier(slotKey, prefix);
  const next = current === 'base' ? 'blessed' : current === 'blessed' ? 'double' : 'base';
  tiers[slotKey] = next;
  const entry = loadout[slotKey];
  if (entry) {
    // Always re-derive from wikiGear base stats to avoid compounding multiplications
    const base = state.wikiGear.find(g => g.name === entry.item.name)
               || state.gear.find(g => g.name === entry.item.name && !g._tier);
    if (base) entry.item = { ...entry.item, stats: applyTier(base.stats, next), _tier: next };
  }
  renderBothLoadouts();
}

const TIER_NOTES = {
  base:    'Optimizing with base item stats.',
  blessed: 'Optimizing with Blessed stats — Math.Round(base × 1.5), Res +1. (C# banker\'s rounding)',
  double:  'Optimizing with Godly stats — base × 2, Res +2.'
};

function setTier(t) {
  state.activeTier = t;
  ['base','blessed','double'].forEach(id => {
    document.getElementById('tier-'+id).classList.toggle('active', id===t);
  });
  document.getElementById('tier-note').textContent = TIER_NOTES[t];
  // Re-apply tier to all locked items in loadout
  Object.keys(state.manualLoadout).forEach(key => {
    const entry = state.manualLoadout[key];
    if (entry) {
      const baseItem = state.gear.find(g => g.name === entry.item.name);
      if (baseItem) entry.item = blessedItem(baseItem, state.activeTier);
    }
  });
  renderBothLoadouts();
}

// ── Slot Search Modal ─────────────────────────────────────────────────────────

function openSlotModal(slotKey) {
  // Block secondary if 2H equipped (builder only)
  if (state.modalTargetPrefix !== 'cur-' && slotKey === 'Secondary' && state.manualLoadout['Primary']?.item?.twoHanded) return;
  state.modalTargetSlot = slotKey;
  state.modalActiveIdx = -1;
  const slot = slotFromKey(slotKey);
  const label = slotKey.includes('_') ? slotKey.replace('_0',' 1').replace('_1',' 2') : slot;
  const activeLoadout = getLoadoutByPrefix(state.modalTargetPrefix);
  const current = activeLoadout[slotKey]?.item?.name || '';

  const backdrop = document.createElement('div');
  backdrop.className = 'slot-modal-backdrop';
  backdrop.id = 'slot-modal-backdrop';
  backdrop.onclick = (e) => { if (e.target === backdrop) closeSlotModal(); };

  backdrop.innerHTML = `
    <div class="slot-modal" onclick="event.stopPropagation()">
      <div class="slot-modal-header">
        <span class="slot-modal-title">⚔ ${label}</span>
        <button class="slot-modal-close" onclick="closeSlotModal()">✕</button>
      </div>
      <div class="slot-modal-search">
        <input type="text" id="slot-modal-input" placeholder="Search items…"
          value="${current}"
          oninput="onModalSearch()"
          onkeydown="onModalKey(event)"
          autocomplete="off">
      </div>
      <div class="slot-modal-results" id="slot-modal-results"></div>
    </div>`;

  document.body.appendChild(backdrop);
  const inp = document.getElementById('slot-modal-input');
  inp.focus();
  inp.select();
  onModalSearch();
}

function closeSlotModal() {
  const el = document.getElementById('slot-modal-backdrop');
  if (el) el.remove();
  state.modalTargetSlot = null;
  state.modalTargetPrefix = '';
  state.modalActiveIdx = -1;
}

function onModalSearch() {
  const q = document.getElementById('slot-modal-input').value.trim().toLowerCase();
  const box = document.getElementById('slot-modal-results');
  state.modalActiveIdx = -1;
  const slot = slotFromKey(state.modalTargetSlot);

  // Filter to items valid for this slot
  let pool = state.gear.filter(g => {
    if (g.slot === slot) return true;
    if (g.bothSlots && (slot === 'Primary' || slot === 'Secondary')) return true;
    return false;
  });
  if (q.length >= 1) pool = pool.filter(g => g.name.toLowerCase().includes(q));
  pool = pool.slice(0, 40);

  if (!pool.length) {
    box.innerHTML = `<div class="slot-modal-empty">${q.length ? 'No items match.' : 'No items available for this slot.'}</div>`;
    box._matches = [];
    return;
  }

  box.innerHTML = pool.map((g, i) => {
    const statsStr = Object.entries(g.stats||{}).filter(([,v])=>v>0).map(([k,v])=>`${k.toUpperCase()}+${v}`).join(' ');
    return `<div class="smi" data-idx="${i}" onmousedown="modalSelectItem(${i})">
      <span class="smi-name">${g.name}</span>
      <span class="smi-level">Lv${g.lvl}</span>
      <span class="smi-stats">${statsStr || '—'}</span>
    </div>`;
  }).join('');
  box._matches = pool;
}

function onModalKey(e) {
  const box = document.getElementById('slot-modal-results');
  const items = box.querySelectorAll('.smi');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.modalActiveIdx = Math.min(state.modalActiveIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === state.modalActiveIdx));
    if (items[state.modalActiveIdx]) items[state.modalActiveIdx].scrollIntoView({block:'nearest'});
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.modalActiveIdx = Math.max(state.modalActiveIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === state.modalActiveIdx));
    if (items[state.modalActiveIdx]) items[state.modalActiveIdx].scrollIntoView({block:'nearest'});
  } else if (e.key === 'Enter') {
    const idx = state.modalActiveIdx >= 0 ? state.modalActiveIdx : 0;
    modalSelectItem(idx);
  } else if (e.key === 'Escape') {
    closeSlotModal();
  }
}

function modalSelectItem(idx) {
  const box = document.getElementById('slot-modal-results');
  const matches = box._matches;
  if (!matches || !matches[idx]) return;
  const item = matches[idx];
  const slotKey = state.modalTargetSlot;
  const loadout = getLoadoutByPrefix(state.modalTargetPrefix);

  // Block secondary if 2H in primary (builder only)
  if (state.modalTargetPrefix !== 'cur-' && slotKey === 'Secondary' && state.manualLoadout['Primary']?.item?.twoHanded) {
    closeSlotModal();
    return;
  }
  // If placing a 2H in Primary in builder, clear Secondary
  if (state.modalTargetPrefix !== 'cur-' && slotKey === 'Primary' && item.twoHanded) {
    delete state.manualLoadout['Secondary'];
    delete state.slotTiers['Secondary'];
  }

  loadout[slotKey] = { item: blessedItem(item, state.activeTier), locked: false };
  closeSlotModal();
  renderBothLoadouts();
}

// Escape key closes modal globally
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('slot-modal-backdrop')) closeSlotModal();
});
// ─────────────────────────────────────────────────────────────────────────────



function optimizeAndScroll() {
  runOptimize();
  setTimeout(() => {
    const el = document.getElementById('results');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function toggleAddItem() {
  state.addItemOpen = !state.addItemOpen;
  document.getElementById('add-item-body').style.display = state.addItemOpen ? 'block' : 'none';
  document.getElementById('add-item-chevron').style.transform = state.addItemOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

function toggleGearDb() {
  state.gearDbOpen = !state.gearDbOpen;
  document.getElementById('gear-db-body').style.display = state.gearDbOpen ? 'block' : 'none';
  document.getElementById('gear-db-chevron').style.transform = state.gearDbOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

function runOptimize() {
  const fl = parseInt(document.getElementById('filter-level').value) || 999;
  if (!state.gear.length) {
    document.getElementById('loadout-builder-panel').innerHTML = '<div class="empty-state" style="border:1px solid var(--border);border-radius:4px;padding:2rem">Add gear or load wiki gear first!</div>';
    return;
  }
  optimize(state.gear, state.manualLoadout, state.slotTiers, state.activeTier, state.weights, fl);
  renderBothLoadouts();
}

function makeToggle(headerId) {
  document.getElementById(headerId).addEventListener('click', function() {
    const body = this.parentElement.querySelector('[class$="-body"]');
    const chevron = this.querySelector('.chevron');
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (chevron) chevron.textContent = isHidden ? '▼ hide' : '▶ show';
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// GEAR_DATA is defined by gear.js, loaded as a plain <script> tag before
// main.js. This allows the page to work when opened directly as a file://
// URL without needing a local HTTP server.
if (typeof GEAR_DATA === 'undefined') {
  document.body.innerHTML = '<p style="color:red;padding:2rem">Failed to load gear data. Make sure gear.js exists (run: uv run generate.py)</p>';
} else {
  state.wikiGear = GEAR_DATA;
  init();
  makeToggle('tutorial-header');
  makeToggle('notes-header');
}

// ── Test surface ──────────────────────────────────────────────────────────────
// Exposes internal functions to Playwright tests. Named to signal intent;
// kept permanently so tests remain simple throughout the refactor.
window.__erenshorTest = {
  // scoring
  getItemEffects,
  getItemPermEffects,
  effectBlocked,
  claimLines,
  score,
  scoreInContext,
  // effects
  sumLoadoutEffects,
  // optimizer
  bankersRound,
  applyTier,
  blessedItem: (item) => blessedItem(item, state.activeTier),
  optimize: runOptimize,
  computeMaxScore: () => {
    const fl = parseInt(document.getElementById('filter-level').value) || 999;
    return computeMaxScore(state.gear, state.activeTier, state.weights, fl);
  },
  // state
  state,
};
