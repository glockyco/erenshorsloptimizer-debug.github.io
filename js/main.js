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

function makeToggle(headerId) {
  document.getElementById(headerId).addEventListener('click', function() {
    const body    = this.parentElement.querySelector('[class$="-body"]');
    const chevron = this.querySelector('.chevron');
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (chevron) chevron.textContent = isHidden ? '▼ hide' : '▶ show';
  });
}

// ── Global event listeners ────────────────────────────────────────────────────

document.addEventListener('dragend', () => {
  document.querySelectorAll('.gear-item.dragging').forEach(el => el.classList.remove('dragging'));
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('slot-modal-backdrop')) closeSlotModal();
});

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
