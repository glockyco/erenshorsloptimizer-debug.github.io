# CLAUDE.md

Guidance for LLM agents working on this repository.

## What This Is

A single-page gear optimizer for [Erenshor](https://erenshor.wiki.gg), a
single-player simulated MMORPG. Players set stat weights for their class
and the optimizer finds the highest-scoring gear loadout available to them.

The site is static HTML/CSS/JS hosted on GitHub Pages. There is no build
step. Pushing to `main` deploys immediately.

## File Map

| File | Role | Edit? |
|------|------|-------|
| `index.html` | Page shell: meta tags, font link, structural HTML | Yes |
| `style.css` | All CSS, extracted verbatim from the original | Yes |
| `main.js` | All application logic | Yes |
| `gear.js` | Gear data loaded as a `<script>` tag by `index.html` | **Generated — do not edit by hand** |
| `generate.py` | Fetches the game DB and writes `gear.js` | Yes |
| `LICENSE` | CC0-1.0 | No |

## Data Flow

```
Game database (public URL)
    ↓  generate.py
gear.js  (committed to repo)
    ↓  <script src="gear.js">  — defines GEAR_DATA synchronously
main.js  (scores and optimizes gear)
```

`gear.js` is committed so the page works when opened directly as a
`file://` URL with no local server. Run `generate.py` whenever the
game updates and commit the result.

## How to Update Gear Data

```
uv run generate.py
git add gear.js
git commit -m "chore: update gear data"
git push
```

`generate.py` requires [uv](https://docs.astral.sh/uv/) and nothing else.
It downloads the public Erenshor SQLite database, queries all equippable
gear, and writes `gear.js`.

## Name Mappings

The game database uses internal names that differ from what players see.
`generate.py` translates these automatically:

| Database value | Display value |
|----------------|---------------|
| `Duelist` (class) | `Windblade` |
| `Arm` (slot) | `Arms` |
| `Bracer` (slot) | `Wrist` |
| `Foot` (slot) | `Feet` |
| `Hand` (slot) | `Hands` |
| `Leg` (slot) | `Legs` |
| `PrimaryOrSecondary` (slot) | `Primary` |

Items with no class restriction in the database are assigned to all six
classes. `generate.py` excludes the `Charm` and `General` slots.

## gear.js Data Model

Each entry in `GEAR_DATA` (and the `gear` array at runtime) has this shape:

```js
{
  name: "Item Name",
  slot: "Head",                  // equipment slot display name
  classes: ["Wizard", ...],      // classes that can equip this item
  stats: {                       // permanent base stats from ItemStats table
    str, dex, agi, end,
    int, wis, cha, res,
    mr, er, pr, vr               // Magic/Elemental/Poison/Void Resist
  },
  effects: {
    worn: [                      // WornEffect spells (always active while equipped)
      {
        haste, str, dex, ...,    // stat deltas granted by the spell
        line: "Buff_Haste_Worn", // spell line (absent or "Generic" = always stacks)
        req_lvl: 25              // required level used to resolve line conflicts
      }
    ],
    aura: [ ... ],               // Aura spells — same shape as worn
    proc: [                      // WeaponProcOnHit spells
      { haste, str, ..., chance: 0.1 }  // no line/req_lvl (procs are not self-applied)
    ],
    wand_proc: [ ... ],          // Wand proc spells — same shape as proc
    bow_proc:  [ ... ]           // Bow proc spells — same shape as proc
  },
  relic: true,                   // present and true only for relic items
  source_info: {
    type: "wiki" | "drop",
    name: "Zone or NPC name",    // for wiki drops
    monster: "Monster Name",     // for drop sources
    rarity: "Common" | ...
  },
  twoHanded: true,               // present and true only for two-handed weapons
  bothSlots: true                // present and true only for items that fill
                                 // both Primary and Secondary simultaneously
}
```

`generate.py` writes `gear.js` from the public game database. The `line` and
`req_lvl` fields on worn/aura effects are populated only when the spell's line
is not `Generic` — Generic spells always stack and need no conflict tracking.

## Spell Line Stacking

The game engine (`Stats.cs`, `CheckForHigherLevelSE`) enforces **one active
buff per spell line** — only the effect with the highest `req_lvl` on a given
line can be active at once. Lower-level effects on the same line are silently
suppressed. Spells on the `Generic` line are fully exempt and always stack.

This applies to **worn** and **aura** effects. Proc effects also technically
have lines but are not self-applied, so they are lower priority and not tracked
for conflict purposes.

Real-world lines with multiple conflicting items include `Buff_Haste_Worn`,
`Mana_Recovery_Buff`, `Regen`, `Attack_Buff`, `Buff_Movespeed_Worn`,
`Global_Buff`, and `Buff_Combat_Worn`.

The optimizer handles this with three helpers in `main.js`:

- `effectBlocked(effect, claimedLines)` — returns true if the effect's line is
  already claimed at an equal-or-higher `req_lvl`.
- `claimLines(item, claimedLines)` — registers all worn/aura lines from an item
  into the running `claimedLines` map after the item is placed.
- `scoreInContext(item, claimedLines)` — like `score()` but zeros out any
  worn/aura contribution whose spell line is already claimed.

`optimize()` and `computeMaxScore()` both thread a `claimedLines` map through
their slot passes so that line conflicts are resolved correctly across the full
loadout. `sumLoadoutEffects()` does a two-pass resolution — first finding the
highest-`req_lvl` winner per line across all equipped items, then accumulating
only winning effects — and returns a `lineConflicts` list used to render
in-panel warnings.

## Application Logic (`main.js`)

Key constants at the top of the file:

- `CLASSES` — six classes with icons, descriptions, and default stat weights
- `STATS` — twelve stats: STR, DEX, AGI, END, INT, WIS, CHA, RES, MR, ER, PR,
  VR (Magic/Elemental/Poison/Void Resist). Note: PR = **Poison** Resist, not
  Physical.
- `SLOTS` — fourteen equipment slots
- `MULTI_SLOTS` — slots that accept two items (Ring×2, Wrist×2)

Key functions:

- `init()` — called after `gear.js` defines `GEAR_DATA`; sets up the UI
- `score(item, weights)` — returns a numeric score for an item given weights
- `optimize()` — fills the loadout builder with highest-scoring items
- `renderBothLoadouts()` — renders current gear and loadout builder panels

Gear data is held in the module-level `gear` array. Wiki gear (from
`gear.js`) is loaded once on startup via `loadWikiGear()`. Custom items
added by the user are appended to the same array for the session.

## Testing

The project uses [Playwright](https://playwright.dev/) for smoke tests.
Tests run against a local Python HTTP server — no Node server needed.

**One-time setup** (requires [pnpm](https://pnpm.io/)):

```
pnpm install
pnpm exec playwright install chromium
```

**Run tests:**

```
pnpm test
```

All tests must pass before committing any change to `main.js` or
`index.html`. If a test fails after your change, fix the code (or the
test if the expected behaviour genuinely changed) before committing.

The tests cover: page title, gear loading, class buttons, default active
class, optimizer output, wiki source tags, and class switching.

**Manual local server** (if you need to inspect the page in a browser):

```
python3 -m http.server 8765
```

Then open `http://localhost:8765`.

## Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/) with
prose descriptions per https://cbea.ms/git-commit/.

```
type: short summary in imperative mood

Prose body explaining why, not what. Complete sentences, wrapped at
80 characters. Summary line under 72 characters, no trailing period.
```

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`

Scope: omit — this project has no meaningful subsystems.

Rules:
- Imperative mood: "Add feature" not "Added feature"
- One concept per commit
- Body explains reasoning and context, not a list of files changed
