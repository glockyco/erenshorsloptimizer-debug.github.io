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
gear, and writes `gear.json`.

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

## Application Logic (`main.js`)

Key constants at the top of the file:

- `CLASSES` — six classes with icons, descriptions, and default stat weights
- `STATS` — eight stats (STR, DEX, AGI, END, INT, WIS, CHA, RES)
- `SLOTS` — fourteen equipment slots
- `MULTI_SLOTS` — slots that accept two items (Ring×2, Wrist×2)

Key functions:

- `init()` — called after `gear.json` loads; sets up the UI
- `score(item, weights)` — returns a numeric score for an item given weights
- `optimize()` — fills the loadout builder with highest-scoring items
- `renderBothLoadouts()` — renders current gear and loadout builder panels

Gear data is held in the module-level `gear` array. Wiki gear (from
`gear.json`) is loaded once on startup via `loadWikiGear()`. Custom items
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
