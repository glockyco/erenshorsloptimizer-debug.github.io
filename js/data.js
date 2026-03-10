// ── Class definitions ─────────────────────────────────────────────────────────
const CLASSES = {
  Windblade: {
    icon: '🌊',
    desc: 'Dual-wield melee DPS. Primary stats: DEX (2:1 over STR), AGI. Aura: Presence of Vitheo grants DEX/AGI and Attack Speed.',
    weights: {dex:10,str:7,res:5,agi:4,end:1,int:0,wis:0,cha:0,haste:8,mr:0,er:0,pr:0,vr:0}
  },
  Paladin: {
    icon: '🛡',
    desc: 'Tanky melee with heals. Primary stats: STR and END for survivability, with some INT/WIS for healing. Aura: Presence of Soluna grants STR/END.',
    weights: {str:8,end:8,dex:4,agi:2,int:3,wis:3,cha:1,res:2,haste:0,mr:0,er:0,pr:0,vr:0}
  },
  Reaver: {
    icon: '💀',
    desc: 'Dark melee DPS. Primary stats: STR for damage, END for sustain. Aura: Rising Shadows grants party-wide proc effects.',
    weights: {str:10,end:6,dex:4,agi:3,int:1,wis:0,cha:0,res:3,haste:0,mr:0,er:0,pr:0,vr:0}
  },
  Druid: {
    icon: '🌿',
    desc: 'Nature caster/healer. Primary stats: INT and WIS for spells, AGI for some builds. Aura: Presence of Fernalla grants Lifesteal.',
    weights: {int:10,wis:8,agi:4,end:3,str:2,dex:1,cha:2,res:1,haste:0,mr:0,er:0,pr:0,vr:0}
  },
  Stormcaller: {
    icon: '⚡',
    desc: 'Elemental caster DPS. Primary stats: INT for spell power, AGI from aura. Aura: Presence of Storms grants AGI and Magic Resist.',
    weights: {int:10,agi:6,wis:5,dex:2,end:2,str:1,cha:2,res:1,haste:5,mr:0,er:0,pr:0,vr:0}
  },
  Arcanist: {
    icon: '✨',
    desc: 'Pure magic DPS/utility. Primary stats: INT for damage, WIS and CHA for mana sustain. Aura: Presence of Brax grants INT/WIS/CHA.',
    weights: {int:10,wis:7,cha:5,end:2,agi:1,str:0,dex:0,res:1,haste:0,mr:0,er:0,pr:0,vr:0}
  }
};

const STATS = [
  {key:'str',label:'Strength',        abbr:'STR'},
  {key:'dex',label:'Dexterity',       abbr:'DEX'},
  {key:'agi',label:'Agility',         abbr:'AGI'},
  {key:'end',label:'Endurance',       abbr:'END'},
  {key:'int',label:'Intelligence',    abbr:'INT'},
  {key:'wis',label:'Wisdom',          abbr:'WIS'},
  {key:'cha',label:'Charisma',        abbr:'CHA'},
  {key:'res',label:'Resonance',       abbr:'RES'},
  {key:'mr', label:'Magic Resist',    abbr:'MR'},
  {key:'er', label:'Elemental Resist',abbr:'ER'},
  {key:'pr', label:'Poison Resist',   abbr:'PR'},
  {key:'vr', label:'Void Resist',     abbr:'VR'},
];

const SLOTS = ['Head','Neck','Chest','Back','Arms','Waist','Legs','Feet','Hands','Wrist','Ring','Primary','Secondary','Aura'];
const MULTI_SLOTS = {Ring:2, Wrist:2};
