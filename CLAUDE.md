# CLAUDE.md

Guidance for LLM agents working on this repository.

## What This Is

A single-page gear optimizer for [Erenshor](https://erenshor.wiki.gg), a
single-player simulated MMORPG. No build step — the page must work when
opened directly as a `file://` URL. Pushing to `main` deploys to GitHub Pages.

## Constraints

- No build step, no bundler, no framework. Plain HTML/CSS/JS only.
- Use `pnpm`, not npm.
- `gear.js` is generated — do not edit by hand.

## Commands

Update gear data after a game patch (pulls from a community-hosted,
data-mined SQLite DB — not an official source):

```
uv run generate.py
git add gear.js
git commit -m "chore: update gear data"
```

Run tests (kill port 8765 first if already in use):

```
lsof -ti:8765 | xargs kill -9 2>/dev/null; sleep 1
pnpm test
```

All tests must pass before committing any change to `main.js` or `index.html`.

One-time test setup:

```
pnpm install
pnpm exec playwright install chromium
```

## Relic Items

Relic items (`item.relic === true`) cannot be equipped in two slots
simultaneously — a relic ring cannot fill both Ring slots, for example. The
optimizer enforces this; non-relic items have no such restriction.

## Spell Line Stacking

The game engine enforces one active buff per spell line — only the effect with
the highest `req_lvl` on a given line can be active at once. Spells on the
`Generic` line are exempt and always stack. This rule applies to worn and aura
effects; proc effects are not self-applied and are not tracked for conflicts.

The source of truth is `CheckForHigherLevelSE()` in `Stats.cs` in the game
source, which is not in this repository.

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
