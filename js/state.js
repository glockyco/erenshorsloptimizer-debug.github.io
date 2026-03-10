// Single object owning all mutable runtime data. Mutated in place throughout
// the app — no individual exported let bindings to avoid live-binding confusion.
const state = {
  gear: [],
  weights: {},
  activeClass: 'Windblade',
  manualLoadout: {},
  dragItemId: null,
  currentLoadout: {},
  loadoutScores: { current: 0, builder: 0 },
  activeTier: 'base',
  slotTiers: {},
  currentSlotTiers: {},
  wikiGear: [],
  modalTargetSlot: null,
  modalTargetPrefix: '',
  modalActiveIdx: -1,
  addItemOpen: false,
  gearDbOpen: false,
};
