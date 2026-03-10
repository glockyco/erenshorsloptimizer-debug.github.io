# /// script
# dependencies = ["requests"]
# ///
"""Generate gear.js from the Erenshor game database.

Downloads the public Erenshor SQLite database, queries all equippable
gear (excluding the Charm slot), and writes gear.js for use by the
optimizer.

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

# Slots excluded from the optimizer.
# Charm items use proficiency scaling rather than flat stats and are
# not yet supported. General is not an equipment slot.
EXCLUDED_SLOTS = {"General", "Charm"}

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

STAT_KEYS = ["Str", "End", "Dex", "Agi", "Int", "Wis", "Cha", "Res"]

TWOHANDED_WEAPON_TYPES = {"TwoHandMelee", "TwoHandBow", "TwoHandStaff"}

QUERY = """
    SELECT
        i.ItemName,
        i.RequiredSlot,
        i.ThisWeaponType,
        i.ItemLevel,
        s.Str,
        s.End,
        s.Dex,
        s.Agi,
        s.Int,
        s.Wis,
        s.Cha,
        s.Res,
        GROUP_CONCAT(c.ClassName, ',') AS Classes
    FROM Items i
    JOIN ItemStats s
        ON i.StableKey = s.ItemStableKey AND s.Quality = 'Normal'
    LEFT JOIN ItemClasses c
        ON i.StableKey = c.ItemStableKey
    WHERE i.RequiredSlot NOT IN ({excluded})
    GROUP BY i.StableKey
    ORDER BY i.RequiredSlot, i.ItemLevel, i.ItemName
""".format(excluded=", ".join(f"'{s}'" for s in EXCLUDED_SLOTS))


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
    # Deduplicate while preserving order
    seen: set[str] = set()
    result = []
    for name in names:
        if name not in seen:
            seen.add(name)
            result.append(name)
    return result


def build_gear(db_path: Path) -> list[dict]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(QUERY).fetchall()
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
