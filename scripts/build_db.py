"""Build pokemon.sqlite from PokeAPI's CSV data dumps.

Downloads raw CSVs from the PokeAPI GitHub repo (cached in data/raw/),
transforms them into a learner-friendly schema, and writes the database
to web/public/pokemon.sqlite so the web IDE can fetch it.

Usage:
    py scripts/build_db.py            # uses cached CSVs if present
    py scripts/build_db.py --refresh  # re-download CSVs
"""

import csv
import sqlite3
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
DB_PATH = ROOT / "web" / "public" / "pokemon.sqlite"

CSV_BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/"
SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/"

CSV_FILES = [
    "pokemon.csv",
    "pokemon_species.csv",
    "pokemon_species_names.csv",
    "pokemon_stats.csv",
    "pokemon_types.csv",
    "types.csv",
    "pokemon_abilities.csv",
    "abilities.csv",
    "ability_names.csv",
    "generations.csv",
    "regions.csv",
    "pokemon_colors.csv",
    "pokemon_habitats.csv",
    "egg_groups.csv",
    "pokemon_egg_groups.csv",
    "type_efficacy.csv",
]

ENGLISH = "9"  # local_language_id for English rows in *_names.csv files

ROMAN = {
    "i": "I", "ii": "II", "iii": "III", "iv": "IV", "v": "V",
    "vi": "VI", "vii": "VII", "viii": "VIII", "ix": "IX", "x": "X",
}


def download_csvs(refresh: bool) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name in CSV_FILES:
        dest = RAW_DIR / name
        if dest.exists() and not refresh:
            continue
        url = CSV_BASE + name
        print(f"  downloading {name}")
        urllib.request.urlretrieve(url, dest)


def read_csv(name: str) -> list[dict]:
    with open(RAW_DIR / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(value: str):
    """'' -> None, otherwise int."""
    return int(value) if value else None


SCHEMA = """
CREATE TABLE generations (
    id      INTEGER PRIMARY KEY,
    name    TEXT NOT NULL,   -- e.g. 'Generation I'
    region  TEXT NOT NULL    -- e.g. 'Kanto'
);

CREATE TABLE types (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL      -- e.g. 'fire'
);

-- Type effectiveness chart: damage_factor is 0, 0.5, 1, or 2.
CREATE TABLE type_matchups (
    attacking_type_id  INTEGER NOT NULL REFERENCES types(id),
    defending_type_id  INTEGER NOT NULL REFERENCES types(id),
    damage_factor      REAL NOT NULL,
    PRIMARY KEY (attacking_type_id, defending_type_id)
);

CREATE TABLE abilities (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL      -- e.g. 'Solar Power'
);

CREATE TABLE egg_groups (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL
);

-- One row per species (default form only). id = National Dex number.
CREATE TABLE pokemon (
    id               INTEGER PRIMARY KEY,
    name             TEXT NOT NULL,
    generation_id    INTEGER NOT NULL REFERENCES generations(id),
    height_m         REAL,
    weight_kg        REAL,
    base_experience  INTEGER,
    hp               INTEGER,
    attack           INTEGER,
    defense          INTEGER,
    special_attack   INTEGER,
    special_defense  INTEGER,
    speed            INTEGER,
    total_stats      INTEGER,
    genus            TEXT,    -- e.g. 'Seed Pokemon'
    color            TEXT,
    habitat          TEXT,    -- only recorded for Gen 1-3; NULL otherwise
    capture_rate     INTEGER,
    base_happiness   INTEGER,
    is_legendary     INTEGER NOT NULL DEFAULT 0,
    is_mythical      INTEGER NOT NULL DEFAULT 0,
    is_baby          INTEGER NOT NULL DEFAULT 0,
    evolves_from_id  INTEGER REFERENCES pokemon(id),
    sprite_url       TEXT
);

CREATE TABLE pokemon_types (
    pokemon_id  INTEGER NOT NULL REFERENCES pokemon(id),
    type_id     INTEGER NOT NULL REFERENCES types(id),
    slot        INTEGER NOT NULL,  -- 1 = primary, 2 = secondary
    PRIMARY KEY (pokemon_id, type_id)
);

CREATE TABLE pokemon_abilities (
    pokemon_id  INTEGER NOT NULL REFERENCES pokemon(id),
    ability_id  INTEGER NOT NULL REFERENCES abilities(id),
    is_hidden   INTEGER NOT NULL,
    slot        INTEGER NOT NULL,
    PRIMARY KEY (pokemon_id, slot)
);

CREATE TABLE pokemon_egg_groups (
    pokemon_id    INTEGER NOT NULL REFERENCES pokemon(id),
    egg_group_id  INTEGER NOT NULL REFERENCES egg_groups(id),
    PRIMARY KEY (pokemon_id, egg_group_id)
);

CREATE INDEX idx_pokemon_types_type ON pokemon_types(type_id);
CREATE INDEX idx_pokemon_generation ON pokemon(generation_id);

-- Flattened one-row-per-Pokemon view: the easy starting point.
CREATE VIEW pokedex AS
SELECT
    p.id,
    p.name,
    g.name  AS generation,
    g.region,
    t1.name AS type1,
    t2.name AS type2,
    p.hp, p.attack, p.defense,
    p.special_attack, p.special_defense, p.speed,
    p.total_stats,
    p.height_m, p.weight_kg,
    p.is_legendary, p.is_mythical,
    pre.name AS evolves_from,
    p.sprite_url
FROM pokemon p
JOIN generations g   ON g.id = p.generation_id
LEFT JOIN pokemon_types pt1 ON pt1.pokemon_id = p.id AND pt1.slot = 1
LEFT JOIN types t1          ON t1.id = pt1.type_id
LEFT JOIN pokemon_types pt2 ON pt2.pokemon_id = p.id AND pt2.slot = 2
LEFT JOIN types t2          ON t2.id = pt2.type_id
LEFT JOIN pokemon pre       ON pre.id = p.evolves_from_id;
"""


def build() -> None:
    regions = {r["id"]: r["identifier"].capitalize() for r in read_csv("regions.csv")}
    colors = {r["id"]: r["identifier"] for r in read_csv("pokemon_colors.csv")}
    habitats = {r["id"]: r["identifier"] for r in read_csv("pokemon_habitats.csv")}

    # English display names and genus, keyed by species id
    names: dict[str, tuple[str, str]] = {}
    for row in read_csv("pokemon_species_names.csv"):
        if row["local_language_id"] == ENGLISH:
            names[row["pokemon_species_id"]] = (row["name"], row["genus"])

    ability_names = {
        row["ability_id"]: row["name"]
        for row in read_csv("ability_names.csv")
        if row["local_language_id"] == ENGLISH
    }

    # Default-form pokemon rows keyed by species id (alternate forms have
    # ids >= 10000 and is_default = 0; we skip them for v1).
    default_forms = {
        row["species_id"]: row
        for row in read_csv("pokemon.csv")
        if row["is_default"] == "1"
    }

    # Base stats keyed by pokemon id: stat_id 1..6 -> hp..speed
    stats: dict[str, dict[str, int]] = {}
    for row in read_csv("pokemon_stats.csv"):
        stats.setdefault(row["pokemon_id"], {})[row["stat_id"]] = int(row["base_stat"])

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DB_PATH.unlink(missing_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)

    con.executemany(
        "INSERT INTO generations VALUES (?, ?, ?)",
        [
            (
                int(row["id"]),
                "Generation " + ROMAN[row["identifier"].split("-")[1]],
                regions[row["main_region_id"]],
            )
            for row in read_csv("generations.csv")
        ],
    )

    main_types = [r for r in read_csv("types.csv") if int(r["id"]) < 10000]
    con.executemany(
        "INSERT INTO types VALUES (?, ?)",
        [(int(r["id"]), r["identifier"]) for r in main_types],
    )
    type_ids = {int(r["id"]) for r in main_types}

    con.executemany(
        "INSERT INTO type_matchups VALUES (?, ?, ?)",
        [
            (int(r["damage_type_id"]), int(r["target_type_id"]), int(r["damage_factor"]) / 100)
            for r in read_csv("type_efficacy.csv")
            if int(r["damage_type_id"]) in type_ids and int(r["target_type_id"]) in type_ids
        ],
    )

    main_abilities = [
        r for r in read_csv("abilities.csv")
        if r["is_main_series"] == "1" and int(r["id"]) < 10000
    ]
    con.executemany(
        "INSERT INTO abilities VALUES (?, ?)",
        [
            (int(r["id"]), ability_names.get(r["id"], r["identifier"]))
            for r in main_abilities
        ],
    )
    ability_ids = {int(r["id"]) for r in main_abilities}

    con.executemany(
        "INSERT INTO egg_groups VALUES (?, ?)",
        [(int(r["id"]), r["identifier"]) for r in read_csv("egg_groups.csv")],
    )

    species_rows = read_csv("pokemon_species.csv")
    for sp in species_rows:
        form = default_forms.get(sp["id"])
        if form is None:
            print(f"  warning: no default form for species {sp['identifier']}, skipping")
            continue
        st = stats.get(form["id"], {})
        stat_values = [st.get(str(i)) for i in range(1, 7)]
        display_name, genus = names.get(sp["id"], (sp["identifier"], None))
        con.execute(
            "INSERT INTO pokemon VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                int(sp["id"]),
                display_name,
                int(sp["generation_id"]),
                int(form["height"]) / 10 if form["height"] else None,   # decimetres -> m
                int(form["weight"]) / 10 if form["weight"] else None,   # hectograms -> kg
                num(form["base_experience"]),
                *stat_values,
                sum(v for v in stat_values if v is not None) or None,
                genus,
                colors.get(sp["color_id"]),
                habitats.get(sp["habitat_id"]),
                num(sp["capture_rate"]),
                num(sp["base_happiness"]),
                int(sp["is_legendary"] or 0),
                int(sp["is_mythical"] or 0),
                int(sp["is_baby"] or 0),
                num(sp["evolves_from_species_id"]),
                f"{SPRITE_BASE}{sp['id']}.png",
            ),
        )

    species_ids = {int(sp["id"]) for sp in species_rows}
    # pokemon_types / pokemon_abilities are keyed by pokemon id; default-form
    # pokemon ids equal their species ids, so filtering to species ids keeps
    # exactly the default forms.
    con.executemany(
        "INSERT INTO pokemon_types VALUES (?, ?, ?)",
        [
            (int(r["pokemon_id"]), int(r["type_id"]), int(r["slot"]))
            for r in read_csv("pokemon_types.csv")
            if int(r["pokemon_id"]) in species_ids and int(r["type_id"]) in type_ids
        ],
    )
    con.executemany(
        "INSERT INTO pokemon_abilities VALUES (?, ?, ?, ?)",
        [
            (int(r["pokemon_id"]), int(r["ability_id"]), int(r["is_hidden"]), int(r["slot"]))
            for r in read_csv("pokemon_abilities.csv")
            if int(r["pokemon_id"]) in species_ids and int(r["ability_id"]) in ability_ids
        ],
    )
    con.executemany(
        "INSERT INTO pokemon_egg_groups VALUES (?, ?)",
        [
            (int(r["species_id"]), int(r["egg_group_id"]))
            for r in read_csv("pokemon_egg_groups.csv")
            if int(r["species_id"]) in species_ids
        ],
    )

    con.commit()

    for table in ("pokemon", "types", "abilities", "pokemon_types", "type_matchups"):
        count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table}: {count} rows")
    con.close()
    print(f"  wrote {DB_PATH} ({DB_PATH.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    refresh = "--refresh" in sys.argv
    print("Downloading CSVs...")
    download_csvs(refresh)
    print("Building database...")
    build()
    print("Done.")
