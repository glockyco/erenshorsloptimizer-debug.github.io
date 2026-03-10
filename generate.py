# /// script
# dependencies = ["requests"]
# ///
"""Generate gear.js from the Erenshor game database.

Downloads the public Erenshor SQLite database, queries all equippable
gear (including Charms), and writes gear.js for use by the optimizer.

Usage:
    uv run generate.py
"""

import json
import sqlite3
import tempfile
from pathlib import Path

import requests

DB_URL = "https://erenshor-maps.wowmuch1.workers.dev/db/erenshor.sqlite"

OUTPUT = Path(__file__).parent / "gear.js"

# General is not an equipment slot — everything else is included.
# Charm items have only scaling stats (no flat values), so the optimizer
# scores them as zero and never selects them. They are included so players
# can see them in the gear list.
EXCLUDED_SLOTS = {"General"}

# The database uses the old internal class name. Map it to the current
# user-facing name used throughout the game and this optimizer.
CLASS_NAME_MAP = {
    "Duelist": "Windblade",
}

# The database uses internal slot names that differ from the display
# names used in the optimizer UI.
SLOT_NAME_MAP = {
    "Arm": "Arms",
    "Bracer": "Wrist",
    "Foot": "Feet",
    "Hand": "Hands",
    "Leg": "Legs",
    "PrimaryOrSecondary": "Primary",
}

ALL_CLASSES = ["Windblade", "Paladin", "Reaver", "Druid", "Stormcaller", "Arcanist"]

# MR/ER/PR/VR are direct item stats (ItemStats table) — included here so
# they appear in item.stats and are scored alongside other stats.
STAT_KEYS = ["Str", "End", "Dex", "Agi", "Int", "Wis", "Cha", "Res", "MR", "ER", "PR", "VR"]

TWOHANDED_WEAPON_TYPES = {"TwoHandMelee", "TwoHandBow", "TwoHandStaff"}

# Spell columns to read for each effect bucket. All are in the Spells table.
SPELL_FIELDS = [
    "Haste",
    "Str",
    "Dex",
    "End",
    "Agi",
    "Int",
    "Wis",
    "Cha",
    "MR",
    "ER",
    "PR",
    "VR",
    "HP",
    "AC",
    "Mana",
    "PercentLifesteal",
    "AtkRollModifier",
    "MovementSpeed",
    "DamageShield",
    "XPBonus",
    "TargetDamage",
    "TargetHealing",
    "CasterHealing",
    "AddProcChance",
]

# DB column name → JS key. Columns not listed are lowercased as-is.
SPELL_KEY_MAP = {
    "PercentLifesteal": "lifesteal",
    "AtkRollModifier": "atkroll",
    "MovementSpeed": "movespeed",
    "DamageShield": "damage_shield",
    "XPBonus": "xp_bonus",
    "TargetDamage": "target_damage",
    "TargetHealing": "target_healing",
    "CasterHealing": "caster_healing",
    "AddProcChance": "add_proc_chance",
}

# Build SELECT fragments for one spell join using a column prefix.
_SPELL_SELECT = ", ".join(f"{{alias}}.{col} AS {{prefix}}{col}" for col in SPELL_FIELDS)


def _spell_selects(alias: str, prefix: str) -> str:
    return ", ".join(f"{alias}.{col} AS {prefix}{col}" for col in SPELL_FIELDS)


GEAR_QUERY = """
    SELECT
        i.StableKey,
        i.ItemName,
        i.RequiredSlot,
        i.ThisWeaponType,
        i.ItemLevel,
        i.Relic,
        s.Str,
        s.End,
        s.Dex,
        s.Agi,
        s.Int,
        s.Wis,
        s.Cha,
        s.Res,
        s.MR,
        s.ER,
        s.PR,
        s.VR,
        GROUP_CONCAT(c.ClassName, ',') AS Classes,
        i.WeaponProcChance,
        i.WandProcChance,
        i.BowProcChance,
        ws.Line  AS w_Line,
        ws.RequiredLevel AS w_RequiredLevel,
        aus.Line AS a_Line,
        aus.RequiredLevel AS a_RequiredLevel,
        {worn_sel},
        {aura_sel},
        {proc_sel},
        {wand_sel},
        {bow_sel}
    FROM Items i
    JOIN ItemStats s
        ON i.StableKey = s.ItemStableKey AND s.Quality = 'Normal'
    LEFT JOIN ItemClasses c
        ON i.StableKey = c.ItemStableKey
    LEFT JOIN Spells ws
        ON i.WornEffectStableKey = ws.StableKey
    LEFT JOIN Spells aus
        ON i.AuraStableKey = aus.StableKey
    LEFT JOIN Spells wps
        ON i.WeaponProcOnHitStableKey = wps.StableKey
    LEFT JOIN Spells wds
        ON i.WandEffectStableKey = wds.StableKey
    LEFT JOIN Spells bws
        ON i.BowEffectStableKey = bws.StableKey
    WHERE i.RequiredSlot NOT IN ({excluded})
    GROUP BY i.StableKey
    ORDER BY i.RequiredSlot, i.ItemLevel, i.ItemName
""".format(
    worn_sel=_spell_selects("ws", "w_"),
    aura_sel=_spell_selects("aus", "a_"),
    proc_sel=_spell_selects("wps", "wp_"),
    wand_sel=_spell_selects("wds", "wdp_"),
    bow_sel=_spell_selects("bws", "bp_"),
    excluded=", ".join(f"'{s}'" for s in EXCLUDED_SLOTS),
)

# Craftable items: any item that is a crafting reward.
CRAFTABLE_QUERY = """
    SELECT DISTINCT RewardItemStableKey FROM CraftingRewards
"""

# Vendor sources: one vendor name per item (alphabetically first).
VENDOR_QUERY = """
    SELECT cvi.ItemStableKey, MIN(c.NPCName) AS vendor
    FROM CharacterVendorItems cvi
    JOIN Characters c ON c.StableKey = cvi.CharacterStableKey
    GROUP BY cvi.ItemStableKey
"""

# Quest reward sources: one quest name per item (alphabetically first).
QUEST_QUERY = """
    SELECT qv.ItemOnCompleteStableKey AS item_stable_key,
           MIN(qv.QuestName) AS quest_name
    FROM QuestVariants qv
    WHERE qv.ItemOnCompleteStableKey IS NOT NULL
      AND qv.ItemOnCompleteStableKey != ''
    GROUP BY qv.ItemOnCompleteStableKey
"""

# Drop sources: lowest-level monster that drops the item (ties broken
# alphabetically). Deduplicates by NPC name before picking the minimum.
DROP_QUERY = """
    SELECT ld.ItemStableKey,
           c.NPCName AS monster,
           c.Level,
           CASE WHEN ld.IsCommon=1    THEN 'common'
                WHEN ld.IsUncommon=1  THEN 'uncommon'
                WHEN ld.IsRare=1      THEN 'rare'
                WHEN ld.IsLegendary=1 THEN 'legendary'
                ELSE 'unknown' END AS rarity
    FROM LootDrops ld
    JOIN Characters c ON c.StableKey = ld.CharacterStableKey
    GROUP BY ld.ItemStableKey, c.NPCName
    ORDER BY ld.ItemStableKey, c.Level, c.NPCName
"""


def download_db(dest: Path) -> None:
    print(f"Downloading database from {DB_URL} ...")
    response = requests.get(DB_URL, stream=True, timeout=60)
    response.raise_for_status()
    with dest.open("wb") as f:
        for chunk in response.iter_content(chunk_size=65536):
            f.write(chunk)
    size_mb = dest.stat().st_size / (1024 * 1024)
    print(f"Downloaded {size_mb:.1f} MB")


def map_classes(raw: str | None) -> list[str]:
    if not raw:
        return ALL_CLASSES
    names = [CLASS_NAME_MAP.get(c, c) for c in raw.split(",")]
    seen: set[str] = set()
    result = []
    for name in names:
        if name not in seen:
            seen.add(name)
            result.append(name)
    return result


def spell_row_to_dict(row: sqlite3.Row, prefix: str) -> dict:
    """Extract non-zero spell fields from a query row using the given column prefix.

    Returns an empty dict if there is no spell (all values null/zero).
    """
    result = {}
    for col in SPELL_FIELDS:
        val = row[f"{prefix}{col}"]
        if not val:
            continue
        js_key = SPELL_KEY_MAP.get(col, col.lower())
        result[js_key] = val
    return result


def build_effects(row: sqlite3.Row) -> dict:
    """Return an effects dict with sub-objects for each active effect bucket.

    worn and aura sub-objects include line/req_lvl metadata so the optimizer
    can enforce the one-per-spell-line stacking rule at runtime.
    """
    effects: dict = {}

    worn = spell_row_to_dict(row, "w_")
    if worn:
        line = row["w_Line"]
        req_lvl = row["w_RequiredLevel"]
        # Generic line spells have no stacking restriction — omit metadata.
        if line and line != "Generic":
            worn["line"] = line
            worn["req_lvl"] = req_lvl if req_lvl is not None else -1
        effects["worn"] = worn

    aura = spell_row_to_dict(row, "a_")
    if aura:
        line = row["a_Line"]
        req_lvl = row["a_RequiredLevel"]
        if line and line != "Generic":
            aura["line"] = line
            aura["req_lvl"] = req_lvl if req_lvl is not None else -1
        effects["aura"] = aura

    proc = spell_row_to_dict(row, "wp_")
    if proc:
        proc["chance"] = row["WeaponProcChance"] or 0
        effects["proc"] = proc

    wand_proc = spell_row_to_dict(row, "wdp_")
    if wand_proc:
        wand_proc["chance"] = row["WandProcChance"] or 0
        effects["wand_proc"] = wand_proc

    bow_proc = spell_row_to_dict(row, "bp_")
    if bow_proc:
        bow_proc["chance"] = row["BowProcChance"] or 0
        effects["bow_proc"] = bow_proc

    return effects


def build_sources(conn: sqlite3.Connection) -> dict[str, dict]:
    """Return a dict keyed by StableKey with the best single source for each item."""
    craftable: set[str] = set()
    for row in conn.execute(CRAFTABLE_QUERY).fetchall():
        craftable.add(row[0])

    vendors: dict[str, str] = {}
    for row in conn.execute(VENDOR_QUERY).fetchall():
        vendors[row["ItemStableKey"]] = row["vendor"]

    quests: dict[str, str] = {}
    for row in conn.execute(QUEST_QUERY).fetchall():
        quests[row["item_stable_key"]] = row["quest_name"]

    # For drops: already ordered by level asc, name asc — first row per item wins.
    drops: dict[str, dict] = {}
    for row in conn.execute(DROP_QUERY).fetchall():
        key = row["ItemStableKey"]
        if key not in drops:
            drops[key] = {"monster": row["monster"], "rarity": row["rarity"]}

    # Merge into best single source per item using priority:
    # craftable > vendor > quest > drop
    sources: dict[str, dict] = {}
    all_keys = craftable | set(vendors) | set(quests) | set(drops)
    for key in all_keys:
        if key in craftable:
            sources[key] = {"type": "craftable"}
        elif key in vendors:
            sources[key] = {"type": "vendor", "name": vendors[key]}
        elif key in quests:
            sources[key] = {"type": "quest", "name": quests[key]}
        elif key in drops:
            sources[key] = {"type": "drop", **drops[key]}
    return sources


def build_gear(db_path: Path) -> list[dict]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(GEAR_QUERY).fetchall()
    sources = build_sources(conn)
    conn.close()

    gear = []
    for row in rows:
        slot = SLOT_NAME_MAP.get(row["RequiredSlot"], row["RequiredSlot"])
        stats = {k.lower(): row[k] for k in STAT_KEYS if row[k]}
        item: dict = {
            "name": row["ItemName"],
            "slot": slot,
            "lvl": row["ItemLevel"],
            "stats": stats,
            "classes": map_classes(row["Classes"]),
        }
        if row["ThisWeaponType"] in TWOHANDED_WEAPON_TYPES:
            item["twoHanded"] = True
        if row["RequiredSlot"] == "PrimaryOrSecondary":
            item["bothSlots"] = True
        if row["Relic"]:
            item["relic"] = True
        source = sources.get(row["StableKey"])
        if source:
            item["source_info"] = source
        effects = build_effects(row)
        if effects:
            item["effects"] = effects
        gear.append(item)

    return gear


def main() -> None:
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        download_db(tmp_path)
        print("Querying gear data ...")
        gear = build_gear(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    OUTPUT.write_text("const GEAR_DATA = " + json.dumps(gear, indent=2) + ";\n", encoding="utf-8")
    print(f"Wrote {len(gear)} items to {OUTPUT}")


if __name__ == "__main__":
    main()
