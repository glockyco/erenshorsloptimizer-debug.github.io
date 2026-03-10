// ── Class definitions ────────────────────────────────────────────────────────
const CLASSES = {
  Windblade: {
    icon: '🌊',
    desc: 'Dual-wield melee DPS. Primary stats: DEX (2:1 over STR), AGI. Aura: Presence of Vitheo grants DEX/AGI and Attack Speed.',
    weights: {dex:10,str:7,res:5,agi:4,end:1,int:0,wis:0,cha:0,haste:8}
  },
  Paladin: {
    icon: '🛡',
    desc: 'Tanky melee with heals. Primary stats: STR and END for survivability, with some INT/WIS for healing. Aura: Presence of Soluna grants STR/END.',
    weights: {str:8,end:8,dex:4,agi:2,int:3,wis:3,cha:1,res:2,haste:0}
  },
  Reaver: {
    icon: '💀',
    desc: 'Dark melee DPS. Primary stats: STR for damage, END for sustain. Aura: Rising Shadows grants party-wide proc effects.',
    weights: {str:10,end:6,dex:4,agi:3,int:1,wis:0,cha:0,res:3,haste:0}
  },
  Druid: {
    icon: '🌿',
    desc: 'Nature caster/healer. Primary stats: INT and WIS for spells, AGI for some builds. Aura: Presence of Fernalla grants Lifesteal.',
    weights: {int:10,wis:8,agi:4,end:3,str:2,dex:1,cha:2,res:1,haste:0}
  },
  Stormcaller: {
    icon: '⚡',
    desc: 'Elemental caster DPS. Primary stats: INT for spell power, AGI from aura. Aura: Presence of Storms grants AGI and Magic Resist.',
    weights: {int:10,agi:6,wis:5,dex:2,end:2,str:1,cha:2,res:1,haste:5}
  },
  Arcanist: {
    icon: '✨',
    desc: 'Pure magic DPS/utility. Primary stats: INT for damage, WIS and CHA for mana sustain. Aura: Presence of Brax grants INT/WIS/CHA.',
    weights: {int:10,wis:7,cha:5,end:2,agi:1,str:0,dex:0,res:1,haste:0}
  }
};

const STATS = [
  {key:'str',label:'Strength',  abbr:'STR'},
  {key:'dex',label:'Dexterity', abbr:'DEX'},
  {key:'agi',label:'Agility',   abbr:'AGI'},
  {key:'end',label:'Endurance', abbr:'END'},
  {key:'int',label:'Intelligence',abbr:'INT'},
  {key:'wis',label:'Wisdom',    abbr:'WIS'},
  {key:'cha',label:'Charisma',  abbr:'CHA'},
  {key:'res',label:'Resonance', abbr:'RES'},
];

const SLOTS = ['Head','Neck','Chest','Back','Arms','Waist','Legs','Feet','Hands','Wrist','Ring','Primary','Secondary','Aura'];
const MULTI_SLOTS = {Ring:2, Wrist:2};


function getItemEffects(item) {
  // Returns aggregated effect totals for scoring and display. Worn and aura
  // effects are always-on; proc effects are discounted at 50%. Spell-sourced
  // resists (mr/er/pr/vr) are separate from item.stats resists — both feed
  // into score() but through different paths (item.stats via STAT_KEYS,
  // spell effects via STATS.forEach on the return value of this function).
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
    // Worn + aura stats feed into main stat scoring via STATS.forEach in score()
    str: (w.str||0) + (a.str||0), dex: (w.dex||0) + (a.dex||0),
    agi: (w.agi||0) + (a.agi||0), end: (w.end||0) + (a.end||0),
    int: (w.int||0) + (a.int||0), wis: (w.wis||0) + (a.wis||0),
    cha: (w.cha||0) + (a.cha||0),
  };
}

function sumLoadoutEffects() {
  const out = {haste:0, haste_worn:0, haste_aura:0, haste_proc:0,
               lifesteal:0, atkroll:0, movespeed:0, mr:0, er:0, pr:0, vr:0,
               wand_proc:null, bow_proc:null};
  Object.values(manualLoadout).forEach(entry => {
    if (!entry?.item) return;
    const e = entry.item.effects || {};
    const w = e.worn || {}, a = e.aura || {}, p = e.proc || {};
    out.haste_worn  += w.haste || 0;
    out.haste_aura  += a.haste || 0;
    out.haste_proc  += (p.haste || 0) * 0.5;
    out.haste       += (w.haste||0) + (a.haste||0) + (p.haste||0)*0.5;
    out.lifesteal   += (w.lifesteal||0) + (a.lifesteal||0) + (p.lifesteal||0)*0.5;
    out.atkroll     += (w.atkroll||0)   + (a.atkroll||0)   + (p.atkroll||0)*0.5;
    out.movespeed   += (w.movespeed||0) + (a.movespeed||0);
    out.mr += (w.mr||0) + (a.mr||0) + (p.mr||0)*0.5;
    out.er += (w.er||0) + (a.er||0) + (p.er||0)*0.5;
    out.pr += (w.pr||0) + (a.pr||0) + (p.pr||0)*0.5;
    out.vr += (w.vr||0) + (a.vr||0) + (p.vr||0)*0.5;
    // Only one wand/bow can be equipped — last item wins (shouldn't conflict)
    if (e.wand_proc) out.wand_proc = e.wand_proc;
    if (e.bow_proc)  out.bow_proc  = e.bow_proc;
  });
  // Cap total haste at 60
  out.haste = Math.min(out.haste, 60);
  return out;
}

let weights = {}, gear = [], activeClass = 'Windblade';

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Build class buttons
  const bar = document.getElementById('class-bar');
  Object.keys(CLASSES).forEach(cls => {
    const btn = document.createElement('button');
    btn.className = 'class-btn' + (cls === activeClass ? ' active' : '');
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

function buildSliders() {
  const container = document.getElementById('stat-weights');
  container.innerHTML = '';

  STATS.forEach(s => {
    const w = weights[s.key] ?? 0;
    container.innerHTML += `<div class="stat-row" id="sr-${s.key}">
      <div class="stat-label" id="sl-${s.key}"><span id="sa-${s.key}">${s.abbr}</span>${s.label}<span id="sp-${s.key}"></span></div>
      <input class="stat-slider" id="ss-${s.key}" type="range" min="0" max="10" value="${w}"
        oninput="onSliderInput('${s.key}',+this.value)">
      <div class="stat-value" id="wv-${s.key}">${w}</div>
    </div>`;
  });

  // Haste slider
  const hw = weights['haste'] ?? 0;
  container.innerHTML += `<div class="stat-row" id="sr-haste" style="border-top:1px solid var(--border);margin-top:.4rem;padding-top:.4rem">
    <div class="stat-label" id="sl-haste"><span id="sa-haste" style="color:#a0c8ff">HST</span>Haste<span id="sp-haste"></span></div>
    <input class="stat-slider" id="ss-haste" type="range" min="0" max="10" value="${hw}"
      style="accent-color:#a0c8ff"
      oninput="onSliderInput('haste',+this.value)">
    <div class="stat-value" id="wv-haste" style="color:#a0c8ff">${hw}</div>
  </div>`;

  updateSliderHighlights();
}

function onSliderInput(key, val) {
  weights[key] = val;
  document.getElementById('wv-' + key).textContent = val;
  updateSliderHighlights();
}

function updateSliderHighlights() {
  const allWeights = [...STATS.map(s => weights[s.key] ?? 0), weights['haste'] ?? 0];
  const maxW = Math.max(...allWeights);
  const primaryThreshold = Math.max(7, maxW);
  const PILL_HTML = `<span style="font-family:'Cinzel',serif;font-size:.5rem;letter-spacing:.06em;padding:.05rem .3rem;border-radius:2px;background:rgba(139,105,20,.25);border:1px solid var(--gold);color:var(--gold);text-transform:uppercase;margin-left:.25rem;vertical-align:middle">primary</span>`;

  const allKeys = [...STATS.map(s => s.key), 'haste'];
  allKeys.forEach(key => {
    const w = weights[key] ?? 0;
    const isPrimary = w >= primaryThreshold && w > 0;
    const isHaste = key === 'haste';

    const labelEl = document.getElementById('sl-' + key);
    const abbrEl  = document.getElementById('sa-' + key);
    const pillEl  = document.getElementById('sp-' + key);
    const valEl   = document.getElementById('wv-' + key);
    const sliderEl = document.getElementById('ss-' + key);
    if (!labelEl) return;

    if (isHaste) {
      // Haste label color is always #a0c8ff — don't change it
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

function switchClass(cls, initial=false) {
  activeClass = cls;
  // Update buttons
  document.querySelectorAll('.class-btn').forEach((b,i) => {
    b.classList.toggle('active', Object.keys(CLASSES)[i] === cls);
  });
  // Update description
  document.getElementById('class-desc').textContent = `${CLASSES[cls].icon}  ${cls} — ${CLASSES[cls].desc}`;
  // Reset weights to class defaults
  weights = {...CLASSES[cls].weights};
  buildSliders();
  // Reload gear for new class (keep manual items, replace wiki items)
  if (!initial) {
    gear = gear.filter(g => g.source === 'manual');
    WIKI_GEAR.forEach(item => {
      if (item.classes.includes(cls)) gear.push({...item, source:'wiki', id: Date.now()+Math.random()});
    });
  }
  renderGearList();
  // Clear manual loadout and re-render builder for new class
  Object.keys(manualLoadout).forEach(k => delete manualLoadout[k]);
  renderBothLoadouts();
}

function resetWeights() {
  weights = {...CLASSES[activeClass].weights};
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
  gear.push({name, slot, lvl, stats, source:'manual', classes:[activeClass], id:Date.now()+Math.random()});
  clearForm(); renderGearList();
}

function clearForm() {
  document.getElementById('item-name').value=''; document.getElementById('item-level').value='';
  STATS.forEach(s => { const e=document.getElementById('si-'+s.key); if(e) e.value=''; });
}

function removeItem(id) { gear=gear.filter(g=>g.id!==id); renderGearList(); }

function loadWikiGear() {
  const ex = new Set(gear.map(g=>g.name.toLowerCase())); let added=0;
  WIKI_GEAR.forEach(item => {
    if (item.classes.includes(activeClass) && !ex.has(item.name.toLowerCase())) {
      gear.push({...item, source:'wiki', id:Date.now()+Math.random()}); added++;
    }
  });
  renderGearList();
  if (!added) alert(`All wiki items for ${activeClass} are already loaded.`);
}

function clearAllGear() {
  if (gear.length && confirm('Remove all items from the database?')) {
    gear = [];
    renderGearList();
    renderBothLoadouts();
  }
}

function getFiltered() {
  const fn=document.getElementById('filter-name').value.toLowerCase(),
    fs=document.getElementById('filter-slot').value,
    fl=parseInt(document.getElementById('filter-level').value)||999;
  return gear.filter(g=>(!fn||g.name.toLowerCase().includes(fn))&&(!fs||g.slot===fs)&&(g.lvl<=fl));
}

function renderGearList() {
  const c=document.getElementById('gear-list');
  document.getElementById('gear-count').textContent=`(${gear.length} items)`;
  const f=getFiltered();
  if (!gear.length) { c.innerHTML='<div class="empty-state">No items yet. Click "Load Wiki Gear" to start.</div>'; return; }
  if (!f.length) { c.innerHTML='<div class="empty-state">No items match the filter.</div>'; return; }
  c.innerHTML=f.map(g=>{
    const ss=STATS.filter(s=>g.stats?.[s.key]>0).map(s=>`${s.abbr}+${g.stats[s.key]}`).join(' ');
    const tag=g.source==='wiki'?'<span class="tag tag-wiki">wiki</span>':'<span class="tag tag-manual">custom</span>';
    return `<div class="gear-item" draggable="true" data-id="${g.id}" ondragstart="onItemDragStart(event,${g.id})">
      <span class="gear-item-name">${g.name}${tag}</span>
      <span class="gear-item-slot">Lv${g.lvl}·${g.slot}</span>
      <span class="gear-item-stats">${ss||'—'}</span>
      <button class="btn btn-red" onclick="removeItem(${g.id})">✕</button>
    </div>`;
  }).join('');
}


// ── Manual Loadout ────────────────────────────────────────────────────────────
const manualLoadout = {};
let dragItemId = null;

function slotKeys(slot) {
  const cnt = MULTI_SLOTS[slot] || 1;
  return cnt > 1 ? [slot+'_0', slot+'_1'] : [slot];
}

function slotFromKey(key) {
  return key.replace(/_\d+$/, '');
}

function onItemDragStart(e, id) {
  dragItemId = id;
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
  if (dragItemId === null) return;
  const item = gear.find(g => g.id === dragItemId);
  if (!item) return;
  const targetSlot = slotFromKey(slotKey);
  const primaryItem = manualLoadout['Primary']?.item;
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
    delete manualLoadout['Secondary'];
    delete slotTiers['Secondary'];
  }
  manualLoadout[slotKey] = { item: blessedItem(item), locked: true };
  dragItemId = null;
  renderBothLoadouts();
}

function toggleLock(slotKey) {
  if (manualLoadout[slotKey]) {
    manualLoadout[slotKey].locked = !manualLoadout[slotKey].locked;
    renderBothLoadouts();
  }
}

function clearSlot(slotKey) {
  delete manualLoadout[slotKey];
  delete slotTiers[slotKey];
  renderBothLoadouts();
}

function clearManualLoadout() {
  Object.keys(manualLoadout).forEach(k => delete manualLoadout[k]);
  Object.keys(slotTiers).forEach(k => delete slotTiers[k]);
  renderBothLoadouts();
}

function computeMaxScore() {
  const fl = parseInt(document.getElementById('filter-level').value) || 999;
  const tieredGear = gear.map(blessedItem);
  let maxScore = 0;
  let bestPrimary = null;
  SLOTS.forEach(slot => {
    // Secondary is handled below after we know what Primary picked.
    if (slot === 'Secondary') return;
    const pool = tieredGear.filter(g => g.lvl <= fl && (g.slot === slot || (g.bothSlots && slot === 'Primary')))
      .sort((a,b) => score(b)-score(a));
    const picks = pool.slice(0, MULTI_SLOTS[slot]||1);
    picks.forEach(item => { maxScore += score(item); });
    if (slot === 'Primary') bestPrimary = picks[0] || null;
  });
  // Secondary: skip entirely if the best Primary is two-handed; otherwise
  // exclude the Primary pick to avoid counting the same bothSlots item twice.
  if (!bestPrimary?.twoHanded) {
    const primaryName = bestPrimary?.name;
    const pool = tieredGear.filter(g => g.lvl <= fl && (g.slot === 'Secondary' || g.bothSlots) && g.name !== primaryName)
      .sort((a,b) => score(b)-score(a));
    pool.slice(0, 1).forEach(item => { maxScore += score(item); });
  }
  return maxScore;
}

function effBar(totalScore, maxScore) {
  if (!maxScore || !totalScore) return '';
  const pct = Math.min(100, (totalScore / maxScore) * 100);
  const color = pct>=90?'#c9b44a':pct>=70?'#7fba5a':pct>=50?'#5a9ecc':'#888';
  const label = pct>=95?'Near Perfect':pct>=85?'Excellent':pct>=70?'Strong':pct>=50?'Decent':'Room to Improve';
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

// ── Current Gear loadout ──────────────────────────────────────────────────────
const currentLoadout = {};
// Shared score cache for comparison bar — must be declared before render functions
const _loadoutScores = { current: 0, builder: 0 };

function clearCurrentLoadout() {
  Object.keys(currentLoadout).forEach(k => delete currentLoadout[k]);
  Object.keys(currentSlotTiers).forEach(k => delete currentSlotTiers[k]);
  renderBothLoadouts();
}

// ── Shared slot grid renderer ─────────────────────────────────────────────────


function renderSlotGrid(loadout, opts = {}) {
  // opts: { showLock, showTier, showSource, prefix }
  const { showLock = true, showTier = true, showSource = true, prefix = '' } = opts;
  const totals = {}; STATS.forEach(s => totals[s.key] = 0);
  let totalScore = 0;

  const slotHtml = SLOTS.map(slot => {
    const keys = slotKeys(slot);
    return keys.map((key, ki) => {
      const entry = loadout[key];
      const item = entry ? entry.item : null;
      const locked = entry ? entry.locked : false;
      if (item) { STATS.forEach(s => totals[s.key] += (item.stats?.[s.key]||0)); totalScore += score(item); }
      const slotClass = ['result-slot', item?'equipped':'', locked?'locked':''].filter(Boolean).join(' ');
      const slotLabel = keys.length > 1 ? slot+' '+(ki+1) : slot;
      const domId = `slot-${prefix}${key}`;

      const tierBadge = (showTier && item) ? (() => {
        const t = getSlotTier(key, prefix);
        const label = t==='base'?'Base':t==='blessed'?'✦ Blessed':'✦✦ Godly';
        const col = t==='base'?'var(--text-dim)':t==='blessed'?'var(--gold)':'#e080ff';
        const bg = t==='base'?'transparent':t==='blessed'?'rgba(139,105,20,.15)':'rgba(180,80,255,.12)';
        return `<button onclick="cycleSlotTier('${key}','${prefix}')" title="Click to cycle quality: Base → Blessed → Godly" onmouseover="this.style.filter='brightness(1.4)'" onmouseout="this.style.filter=''" style="font-family:'Cinzel',serif;font-size:.55rem;letter-spacing:.06em;padding:.1rem .35rem;border-radius:2px;border:1px solid ${col};background:${bg};color:${col};cursor:pointer;white-space:nowrap;line-height:1.4;transition:filter .15s">${label} ↻</button>`;
      })() : '';

      const lockBtn = (showLock && item)
        ? `<button class="lock-btn ${locked?'locked':''}" onclick="toggleLockIn('${prefix}','${key}')" title="${locked?'Unlock':'Lock'}">${locked?'🔒':'🔓'}</button>`
        : '';
      const clearBtn = item
        ? `<button class="clear-slot-btn" onclick="clearSlotIn('${prefix}','${key}')" title="Remove">✕</button>`
        : '';
      const headerBtns = item
        ? `<div style="display:flex;gap:.25rem;align-items:center">${tierBadge}${lockBtn}${clearBtn}</div>`
        : '';

      const sourceHtml = (() => {
        if (!showSource || !item) return '';
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
      })();

      const content = item
        ? `<div class="result-item-name">${item.name}</div>
           <div class="result-item-stats">${STATS.filter(s=>item.stats?.[s.key]>0).map(s=>`${s.abbr}+${item.stats[s.key]}`).join('·')||'—'}</div>
           ${sourceHtml}`
        : (() => {
            const pri = loadout['Primary']?.item;
            if (slot === 'Secondary' && pri?.twoHanded) {
              return `<div class="result-empty" style="font-size:.72rem;text-align:center;padding:.4rem 0;opacity:.4;font-style:italic">2H equipped</div>`;
            }
            return `<div class="result-empty" style="font-size:.75rem;text-align:center;padding:.4rem 0;opacity:.5">click to equip</div>`;
          })();

      return `<div class="${slotClass}" id="${domId}"
        onclick="onSlotClickIn(event,'${prefix}','${key}')"
        ondragover="onSlotDragOver(event,'${key}')"
        ondragleave="onSlotDragLeave('${key}')"
        ondrop="onSlotDropIn(event,'${prefix}','${key}')">
        <div class="result-slot-header"><div class="result-slot-name">${slotLabel}</div>${headerBtns}</div>
        ${content}
      </div>`;
    }).join('');
  }).join('');

  return { slotHtml, totals, totalScore };
}

function renderCurrentGear() {
  const { slotHtml, totals, totalScore } = renderSlotGrid(currentLoadout, { showLock: false, showTier: true, showSource: false, prefix: 'cur-' });
  _loadoutScores.current = totalScore;
  const filledCount = Object.keys(currentLoadout).length;

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
          ${STATS.map(s => {
            const val = totals[s.key] || 0;
            const isNeg = val < 0;
            const color = isNeg ? 'var(--red-light)' : val > 0 ? 'var(--text-bright)' : 'var(--text-dim)';
            return `<div class="stat-total">
              <span class="stat-total-name" style="font-size:.65rem">${s.abbr}</span>
              <span class="stat-total-val" style="color:${color};font-size:${Math.min(1.1, 0.7 + val/80)}rem">${isNeg?'':val>0?'+':''}${val}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div style="margin-top:1rem"><div class="result-grid">${slotHtml}</div></div>
    </div>
  </div>`;
}

function renderManualLoadout() {
  const { slotHtml, totals, totalScore } = renderSlotGrid(manualLoadout, { showLock: true, showTier: true, showSource: true, prefix: '' });
  _loadoutScores.builder = totalScore;

  // Compute current gear totals for deltas
  const curTotals = {}; STATS.forEach(s => curTotals[s.key] = 0);
  const hasCurrent = Object.keys(currentLoadout).length > 0;
  if (hasCurrent) {
    SLOTS.forEach(slot => slotKeys(slot).forEach(key => {
      const item = currentLoadout[key]?.item;
      if (item) STATS.forEach(s => curTotals[s.key] += (item.stats?.[s.key]||0));
    }));
  }

  const maxScore = computeMaxScore();
  const fx = sumLoadoutEffects();
  const tierLabel = activeTier==='base'?'':activeTier==='blessed'
    ? ' <span style="color:var(--gold);font-size:.75rem">✦ Blessed</span>'
    : ' <span style="color:#e080ff;font-size:.75rem;text-shadow:0 0 8px rgba(200,100,255,.4)">✦✦ Godly</span>';
  const filledCount = Object.keys(manualLoadout).length;
  const lockedCount = Object.values(manualLoadout).filter(e=>e.locked).length;

  document.getElementById('loadout-builder-panel').innerHTML = `<div class="panel">
    <div class="panel-header"><h2>${activeClass} — Loadout Builder${tierLabel}</h2></div>
    <div class="panel-body">
      <div class="loadout-controls">
        <button class="btn btn-gold" onclick="optimize()" style="font-size:.78rem;padding:.4rem 1rem">⚔ Auto-Fill Empty Slots</button>
        <button class="btn btn-ghost" onclick="clearManualLoadout()" style="font-size:.75rem;padding:.4rem .9rem;color:var(--red-light);border-color:var(--red)">✕ Clear All</button>
        <span style="font-size:.78rem;color:var(--text-dim);font-style:italic">${filledCount>0?`${filledCount} filled · ${lockedCount} locked`:'Click a slot or drag items from the database'}</span>
      </div>
      <div class="score-bar">
        <div style="display:flex;flex-direction:column;gap:.15rem;min-width:80px">
          <div class="score-label">Priority Score</div>
          <div class="score-value">${totalScore.toFixed(1)}</div>
        </div>
        <div style="width:1px;background:var(--border);align-self:stretch;margin:0 .5rem"></div>
        <div style="display:flex;flex-wrap:wrap;gap:.6rem 1.2rem;flex:1">
          ${STATS.map(s => {
            const val = totals[s.key] || 0;
            const delta = hasCurrent ? val - (curTotals[s.key] || 0) : 0;
            const isNeg = val < 0;
            const color = isNeg ? 'var(--red-light)' : val > 0 ? 'var(--text-bright)' : 'var(--text-dim)';
            const deltaHtml = hasCurrent && delta !== 0
              ? `<span style="font-size:.6rem;font-family:'Cinzel',serif;color:${delta>0?'var(--green-light)':'var(--red-light)'};display:block;line-height:1">${delta>0?'▲':'▼'}${Math.abs(delta)}</span>`
              : '';
            return `<div class="stat-total">
              <span class="stat-total-name" style="font-size:.65rem">${s.abbr}</span>
              <span class="stat-total-val" style="color:${color};font-size:${Math.min(1.1, 0.7 + val/80)}rem">${isNeg?'':val>0?'+':''}${val}</span>
              ${deltaHtml}
            </div>`;
          }).join('')}
        </div>
      </div>
      ${effBar(totalScore, maxScore)}
      ${(() => {
        const hasHaste = fx.haste > 0;
        const hasLifesteal = fx.lifesteal > 0;
        const hasAtkroll = fx.atkroll > 0;
        const hasMovespeed = fx.movespeed > 0;
        const hasResist = fx.mr > 0 || fx.er > 0 || fx.pr > 0 || fx.vr > 0;
        const hasWandProc = !!fx.wand_proc;
        const hasBowProc = !!fx.bow_proc;
        if (!hasHaste && !hasLifesteal && !hasAtkroll && !hasMovespeed && !hasResist
            && !hasWandProc && !hasBowProc) return '';
        const pill = (label, val, unit='', color='var(--blue-light)') =>
          `<div style="display:flex;flex-direction:column;gap:.1rem">
            <span style="font-family:'Cinzel',serif;font-size:.6rem;color:var(--text-dim);letter-spacing:.06em">${label}</span>
            <span style="font-family:'Cinzel',serif;font-size:.95rem;color:${color};font-weight:600">+${typeof val==='number'?val.toFixed(1).replace(/\.0$/,''):val}${unit}</span>
          </div>`;
        const procPill = (label, proc, color) => {
          const dmg = proc.target_damage || 0;
          const heal = proc.target_healing || 0;
          const val = dmg || heal;
          const kind = dmg ? 'dmg' : 'heal';
          const chance = proc.chance || 0;
          return `<div style="display:flex;flex-direction:column;gap:.1rem">
            <span style="font-family:'Cinzel',serif;font-size:.6rem;color:var(--text-dim);letter-spacing:.06em">${label}</span>
            <span style="font-family:'Cinzel',serif;font-size:.95rem;color:${color};font-weight:600">${val} ${kind}</span>
            <span style="font-size:.65rem;color:var(--text-dim)">@ ${chance}% chance</span>
          </div>`;
        };
        const hasteColor = fx.haste >= 55 ? '#ff9944' : fx.haste >= 30 ? '#a0c8ff' : 'var(--blue-light)';
        const hasteLabel = fx.haste >= 60 ? 'HASTE (cap)' : 'HASTE';
        const hastePills = hasHaste ? `
          <div style="display:flex;flex-direction:column;gap:.1rem">
            <span style="font-family:'Cinzel',serif;font-size:.6rem;color:var(--text-dim);letter-spacing:.06em">${hasteLabel}</span>
            <span style="font-family:'Cinzel',serif;font-size:.95rem;color:${hasteColor};font-weight:600">+${fx.haste.toFixed(1).replace(/\.0$/,'')}%</span>
            <span style="font-size:.65rem;color:var(--text-dim)">
              ${fx.haste_worn > 0 ? `<span style="color:#a0c8ff">▪ ${fx.haste_worn.toFixed(1).replace(/\.0$/,'')}% worn</span>` : ''}
              ${fx.haste_aura > 0 ? `<span style="color:#c0a0ff;margin-left:.3rem">▪ ${fx.haste_aura.toFixed(1).replace(/\.0$/,'')}% aura</span>` : ''}
              ${fx.haste_proc > 0 ? `<span style="color:var(--text-dim);margin-left:.3rem">▪ ${fx.haste_proc.toFixed(1).replace(/\.0$/,'')}% proc</span>` : ''}
            </span>
          </div>` : '';
        return `<div style="margin-top:.75rem;padding:.65rem .9rem;background:var(--surface2);border:1px solid var(--border);border-radius:3px;border-left:2px solid var(--blue-light)">
          <div style="font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:.12em;color:var(--text-dim);text-transform:uppercase;margin-bottom:.5rem">Spell &amp; Passive Effects</div>
          <div style="display:flex;flex-wrap:wrap;gap:.5rem 1.5rem">
            ${hastePills}
            ${hasLifesteal ? pill('LIFESTEAL', fx.lifesteal, '%', '#e08080') : ''}
            ${hasAtkroll ? pill('ATK ROLL', fx.atkroll, '', '#c9a227') : ''}
            ${hasMovespeed ? pill('MOVE SPD', fx.movespeed, '%', '#80e0a0') : ''}
            ${hasResist && fx.mr > 0 ? pill('MAG RESIST', fx.mr, '', 'var(--text-dim)') : ''}
            ${hasResist && fx.er > 0 ? pill('ELEM RESIST', fx.er, '', 'var(--text-dim)') : ''}
            ${hasResist && fx.pr > 0 ? pill('PHY RESIST', fx.pr, '', 'var(--text-dim)') : ''}
            ${hasResist && fx.vr > 0 ? pill('VOID RESIST', fx.vr, '', 'var(--text-dim)') : ''}
            ${hasWandProc ? procPill('WAND PROC', fx.wand_proc, '#c0a0ff') : ''}
            ${hasBowProc  ? procPill('BOW PROC',  fx.bow_proc,  '#a0d0a0') : ''}
          </div>
        </div>`;
      })()}
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
  const curScore = _loadoutScores.current;
  const bldScore = _loadoutScores.builder;
  const hasCurrent = Object.keys(currentLoadout).length > 0;
  const hasBuilder = Object.keys(manualLoadout).length > 0;

  if (!hasCurrent || !hasBuilder) {
    el.innerHTML = '';
    return;
  }

  const delta = bldScore - curScore;
  const pct = curScore > 0 ? (delta / curScore) * 100 : 0;
  const isFlat = Math.abs(delta) < 0.05;
  const isUpgrade = !isFlat && delta > 0;

  const color = isFlat ? 'var(--text-dim)' : isUpgrade ? 'var(--green-light)' : 'var(--red-light)';
  const barColor = isFlat ? 'var(--border-glow)' : isUpgrade ? '#4aaa4a' : '#c94444';
  const label = isFlat ? 'No change vs current gear'
    : isUpgrade ? `Upgrade over current gear`
    : `Downgrade vs current gear`;
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
        ${isUpgrade ? `left:50%;width:${(barW-50).toFixed(1)}%` : isFlat ? 'left:49%;width:2%' : `left:${barW.toFixed(1)}%;width:${(50-barW).toFixed(1)}%`}"></div>
    </div>
    <div style="font-size:.72rem;color:${color};margin-top:.35rem;font-style:italic">${label}</div>
  </div>`;
}

// ── Slot interaction helpers (prefix-aware) ───────────────────────────────────
function getLoadoutByPrefix(prefix) {
  return prefix === 'cur-' ? currentLoadout : manualLoadout;
}

function onSlotClickIn(e, prefix, key) {
  if (e.target.closest('button')) return;
  modalTargetSlot = key;
  modalTargetPrefix = prefix;
  openSlotModal(key);
}

function clearSlotIn(prefix, key) {
  const loadout = getLoadoutByPrefix(prefix);
  delete loadout[key];
  if (prefix === 'cur-') delete currentSlotTiers[key];
  else delete slotTiers[key];
  renderBothLoadouts();
}

function toggleLockIn(prefix, key) {
  const loadout = getLoadoutByPrefix(prefix);
  if (loadout[key]) { loadout[key].locked = !loadout[key].locked; renderBothLoadouts(); }
}

function onSlotDropIn(e, prefix, key) {
  onSlotDrop(e, key); // drag-drop only applies to builder
}
// ── Optimize ──────────────────────────────────────────────────────────────────
// ── Item Quality / Blessing ──────────────────────────────────────────────────
let activeTier = 'base'; // 'base' | 'blessed' | 'double' (Godly)
const slotTiers = {};        // per-slot tier overrides for builder
const currentSlotTiers = {}; // per-slot tier overrides for current gear

function getSlotTier(slotKey, prefix) {
  const tiers = prefix === 'cur-' ? currentSlotTiers : slotTiers;
  return tiers[slotKey] || activeTier;
}

function cycleSlotTier(slotKey, prefix) {
  prefix = prefix || '';
  const tiers = prefix === 'cur-' ? currentSlotTiers : slotTiers;
  const loadout = getLoadoutByPrefix(prefix);
  const current = getSlotTier(slotKey, prefix);
  const next = current === 'base' ? 'blessed' : current === 'blessed' ? 'double' : 'base';
  tiers[slotKey] = next;
  const entry = loadout[slotKey];
  if (entry) {
    // Always re-derive from WIKI_GEAR base stats to avoid compounding multiplications
    const base = WIKI_GEAR.find(g => g.name === entry.item.name)
               || gear.find(g => g.name === entry.item.name && !g._tier);
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
  activeTier = t;
  ['base','blessed','double'].forEach(id => {
    document.getElementById('tier-'+id).classList.toggle('active', id===t);
  });
  document.getElementById('tier-note').textContent = TIER_NOTES[t];
  // Re-apply tier to all locked items in loadout
  Object.keys(manualLoadout).forEach(key => {
    const entry = manualLoadout[key];
    if (entry) {
      const baseItem = gear.find(g => g.name === entry.item.name);
      if (baseItem) entry.item = blessedItem(baseItem);
    }
  });
  renderBothLoadouts();
}

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

function blessedItem(item) {
  if (activeTier === 'base') return item;
  return { ...item, stats: applyTier(item.stats, activeTier), _tier: activeTier };
}
// ────────────────────────────────────────────────────────────────────────────

// ── Slot Search Modal ─────────────────────────────────────────────────────────
let modalTargetSlot = null;
let modalTargetPrefix = '';
let modalActiveIdx = -1;

function openSlotModal(slotKey) {
  // Block secondary if 2H equipped (builder only)
  if (modalTargetPrefix !== 'cur-' && slotKey === 'Secondary' && manualLoadout['Primary']?.item?.twoHanded) return;
  modalTargetSlot = slotKey;
  modalActiveIdx = -1;
  const slot = slotFromKey(slotKey);
  const label = slotKey.includes('_') ? slotKey.replace('_0',' 1').replace('_1',' 2') : slot;
  const activeLoadout = getLoadoutByPrefix(modalTargetPrefix);
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
  modalTargetSlot = null;
  modalTargetPrefix = '';
  modalActiveIdx = -1;
}

function onModalSearch() {
  const q = document.getElementById('slot-modal-input').value.trim().toLowerCase();
  const box = document.getElementById('slot-modal-results');
  modalActiveIdx = -1;
  const slot = slotFromKey(modalTargetSlot);

  // Filter to items valid for this slot
  let pool = gear.filter(g => {
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
    modalActiveIdx = Math.min(modalActiveIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === modalActiveIdx));
    if (items[modalActiveIdx]) items[modalActiveIdx].scrollIntoView({block:'nearest'});
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    modalActiveIdx = Math.max(modalActiveIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === modalActiveIdx));
    if (items[modalActiveIdx]) items[modalActiveIdx].scrollIntoView({block:'nearest'});
  } else if (e.key === 'Enter') {
    const idx = modalActiveIdx >= 0 ? modalActiveIdx : 0;
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
  const slotKey = modalTargetSlot;
  const loadout = getLoadoutByPrefix(modalTargetPrefix);

  // Block secondary if 2H in primary (builder only)
  if (modalTargetPrefix !== 'cur-' && slotKey === 'Secondary' && manualLoadout['Primary']?.item?.twoHanded) {
    closeSlotModal();
    return;
  }
  // If placing a 2H in Primary in builder, clear Secondary
  if (modalTargetPrefix !== 'cur-' && slotKey === 'Primary' && item.twoHanded) {
    delete manualLoadout['Secondary'];
    delete slotTiers['Secondary'];
  }

  loadout[slotKey] = { item: blessedItem(item), locked: false };
  closeSlotModal();
  renderBothLoadouts();
}

// Escape key closes modal globally
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('slot-modal-backdrop')) closeSlotModal();
});
// ─────────────────────────────────────────────────────────────────────────────


function score(item) {
  if (!item?.stats) return 0;
  let s = STATS.reduce((a,s) => a+(item.stats[s.key]||0)*weights[s.key], 0);
  // Add haste bonus + aura stat bonuses to scoring
  const effs = getItemEffects(item);
  s += effs.haste * (weights['haste'] || 0);
  // Aura items grant stats via their spell — include these in scoring
  STATS.forEach(st => { s += (effs[st.key] || 0) * (weights[st.key] || 0); });
  return s;
}

function optimizeAndScroll() {
  optimize();
  setTimeout(() => {
    const el = document.getElementById('results');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

let addItemOpen = false;
function toggleAddItem() {
  addItemOpen = !addItemOpen;
  document.getElementById('add-item-body').style.display = addItemOpen ? 'block' : 'none';
  document.getElementById('add-item-chevron').style.transform = addItemOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

let gearDbOpen = false;
function toggleGearDb() {
  gearDbOpen = !gearDbOpen;
  document.getElementById('gear-db-body').style.display = gearDbOpen ? 'block' : 'none';
  document.getElementById('gear-db-chevron').style.transform = gearDbOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

function optimize() {
  const fl = parseInt(document.getElementById('filter-level').value) || 999;
  const hasFilter = fl < 999;
  if (!gear.length) {
    document.getElementById('loadout-builder-panel').innerHTML = '<div class="empty-state" style="border:1px solid var(--border);border-radius:4px;padding:2rem">Add gear or load wiki gear first!</div>';
    return;
  }

  const tieredGear = gear.map(blessedItem);
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

  // For each slot key, skip if already locked; fill if empty or unlocked
  SLOTS.forEach(slot => {
    const keys = slotKeys(slot);
    keys.forEach(key => {
      // Skip locked slots
      if (manualLoadout[key] && manualLoadout[key].locked) return;

      // Build pool of items not already chosen for another key of this slot
      const usedNames = keys
        .filter(k => k !== key && manualLoadout[k] && manualLoadout[k].locked)
        .map(k => manualLoadout[k].item.name);

      let pool = bySlot[slot].filter(g => !usedNames.includes(g.name));
      let isFallback = false;

      if (!pool.length && hasFilter && bySlotFallback[slot].length) {
        const minLvl = Math.min(...bySlotFallback[slot].map(g => g.lvl));
        pool = bySlotFallback[slot].filter(g => g.lvl === minLvl && !usedNames.includes(g.name));
        isFallback = true;
      }

      const sorted = pool.slice().sort((a, b) => score(b) - score(a));
      const best = sorted[0];
      if (best) {
        manualLoadout[key] = { item: best, locked: false, fallback: isFallback };
        // If a 2H weapon was just chosen for Primary, clear Secondary so the
        // optimizer does not also fill it — that would be an impossible loadout.
        if (key === 'Primary' && best.twoHanded) {
          bySlot['Secondary'] = [];
          bySlotFallback['Secondary'] = [];
        }
      }
    });
  });

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
  window.WIKI_GEAR = GEAR_DATA;
  init();
  makeToggle('tutorial-header');
  makeToggle('notes-header');
}
