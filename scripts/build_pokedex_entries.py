"""Bundle English Pokédex descriptions for the species in the existing database.

Uses the shared PokeAPI CSV cache. Does not modify pokemon.sqlite.
Run: py scripts/build_pokedex_entries.py [--refresh]
"""

import csv
import json
import sqlite3
import sys
from contextlib import closing

from build_db import CSV_BASE, DB_PATH, ENGLISH, RAW_DIR, ROOT, download_csvs, read_csv

SOURCES = ["pokemon_species_flavor_text.csv", "version_names.csv"]
OUTPUT = ROOT / "web/src/shared/pokemon/pokedex-entries.json"


def build() -> None:
    with closing(sqlite3.connect(f"{DB_PATH.as_uri()}?mode=ro", uri=True)) as database:
        species = dict(database.execute("SELECT id, genus FROM pokemon ORDER BY id"))
    versions = {int(row["version_id"]): row["name"] for row in read_csv("version_names.csv")
                if row["local_language_id"] == ENGLISH}
    descriptions: dict[int, tuple[int, str]] = {}
    with (RAW_DIR / SOURCES[0]).open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            identity, version = int(row["species_id"]), int(row["version_id"])
            if row["language_id"] != ENGLISH or identity not in species:
                continue
            # Prefer the highest available version ID's English entry. Normalize
            # the original game's page/line breaks into a readable paragraph.
            text = " ".join(row["flavor_text"].split())
            if text and version > descriptions.get(identity, (-1, ""))[0]:
                descriptions[identity] = (version, text)
    missing = species.keys() - descriptions.keys()
    if missing:
        raise ValueError(f"Missing English Pokédex descriptions for species: {sorted(missing)}")
    entries = {}
    for identity, category in species.items():
        version, description = descriptions[identity]
        if not category or not versions.get(version):
            raise ValueError(f"Incomplete Pokédex description for species {identity}")
        entries[str(identity)] = {"category": category, "description": description, "version": versions[version]}
    data = {"sources": [CSV_BASE + name for name in SOURCES], "entries": entries}
    temporary = OUTPUT.with_suffix(".json.part")
    try:
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(OUTPUT)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Bundled {len(entries)} English Pokédex entries in {OUTPUT}")


if __name__ == "__main__":
    download_csvs("--refresh" in sys.argv, SOURCES)
    build()
