"""Build pokemon.sqlite from PokeAPI's CSV data dumps.

Downloads raw CSVs from the PokeAPI GitHub repo (cached in data/raw/),
transforms them into a learner-friendly schema, and writes the database
to web/public/pokemon.sqlite so the web IDE can fetch it.

Usage:
    py scripts/build_db.py            # uses cached CSVs if present
    py scripts/build_db.py --refresh  # re-download CSVs
"""

import csv
import shutil
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
    "pokemon_forms.csv",
    "pokemon_form_names.csv",
    "pokemon_form_types.csv",
    "version_groups.csv",
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
    "egg_group_prose.csv",
    "pokemon_egg_groups.csv",
    "type_efficacy.csv",
]

ENGLISH = "9"  # local_language_id for English rows in *_names.csv files

ROMAN = {
    "i": "I", "ii": "II", "iii": "III", "iv": "IV", "v": "V",
    "vi": "VI", "vii": "VII", "viii": "VIII", "ix": "IX", "x": "X",
}

# Named regional variants only. Pikachu's alola-cap is a costume, not an
# Alolan regional form; matching arbitrary region-name prefixes is incorrect.
REGIONAL_FORMS = {
    "alola": "Alola",
    "galar": "Galar", "galar-standard": "Galar", "galar-zen": "Galar",
    "hisui": "Hisui",
    "paldea": "Paldea", "paldea-combat-breed": "Paldea",
    "paldea-blaze-breed": "Paldea", "paldea-aqua-breed": "Paldea",
}


def evolution_metadata(species_rows: list[dict]) -> dict[str, tuple[int, int]]:
    """Species-tree depth, including babies, and whether any species evolves from it."""
    parents = {row["id"]: row["evolves_from_species_id"] for row in species_rows}
    children = {parent for parent in parents.values() if parent}
    stages: dict[str, int] = {}
    visiting: set[str] = set()

    def stage(species_id: str) -> int:
        if species_id in visiting:
            raise ValueError(f"Evolution cycle at species {species_id}")
        if species_id not in stages:
            visiting.add(species_id)
            parent = parents[species_id]
            stages[species_id] = 1 + stage(parent) if parent else 1
            visiting.remove(species_id)
        return stages[species_id]

    return {species_id: (stage(species_id), int(species_id in children)) for species_id in parents}


def download_csvs(refresh: bool, files: list[str] = CSV_FILES) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name in files:
        dest = RAW_DIR / name
        if dest.exists() and not refresh:
            continue
        print(f"  downloading {name}")
        # Download to a temp file and rename into place so an interrupted
        # download can never be mistaken for a valid cached CSV.
        tmp = dest.with_suffix(dest.suffix + ".part")
        try:
            with urllib.request.urlopen(CSV_BASE + name, timeout=30) as resp, open(tmp, "wb") as f:
                shutil.copyfileobj(resp, f)
            tmp.replace(dest)
        finally:
            tmp.unlink(missing_ok=True)


def read_csv(name: str) -> list[dict]:
    with open(RAW_DIR / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(value: str):
    """'' -> None, otherwise int."""
    return int(value) if value else None


SCHEMA = """
PRAGMA user_version = 1;

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
    name  TEXT NOT NULL      -- e.g. 'Water 1', 'Human-Like'
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
    sprite_url       TEXT,
    has_mega_evolution INTEGER NOT NULL DEFAULT 0,
    mega_form_count  INTEGER NOT NULL DEFAULT 0,
    has_regional_form INTEGER NOT NULL DEFAULT 0,
    evolution_stage  INTEGER NOT NULL DEFAULT 1,
    can_evolve       INTEGER NOT NULL DEFAULT 0
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

-- Source form IDs are distinct from species IDs and source pokemon IDs.
-- Each form inherits stats and abilities from its source pokemon variety.
CREATE TABLE pokemon_forms (
    id               INTEGER PRIMARY KEY,
    species_id       INTEGER NOT NULL REFERENCES pokemon(id),
    source_pokemon_id INTEGER NOT NULL,
    identifier       TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    form_name        TEXT,
    is_species_default INTEGER NOT NULL,
    is_mega          INTEGER NOT NULL,
    is_regional      INTEGER NOT NULL,
    regional_region  TEXT,
    is_battle_only   INTEGER NOT NULL,
    introduced_generation_id INTEGER NOT NULL REFERENCES generations(id),
    introduced_version_group TEXT NOT NULL,
    height_m         REAL,
    weight_kg        REAL,
    base_experience  INTEGER,
    hp               INTEGER,
    attack           INTEGER,
    defense          INTEGER,
    special_attack   INTEGER,
    special_defense  INTEGER,
    speed            INTEGER,
    total_stats      INTEGER
);

CREATE TABLE pokemon_form_types (
    form_id INTEGER NOT NULL REFERENCES pokemon_forms(id),
    type_id INTEGER NOT NULL REFERENCES types(id),
    slot    INTEGER NOT NULL,
    PRIMARY KEY (form_id, type_id),
    UNIQUE (form_id, slot)
);

CREATE TABLE pokemon_form_abilities (
    form_id    INTEGER NOT NULL REFERENCES pokemon_forms(id),
    ability_id INTEGER NOT NULL REFERENCES abilities(id),
    is_hidden  INTEGER NOT NULL,
    slot       INTEGER NOT NULL,
    PRIMARY KEY (form_id, slot)
);

CREATE INDEX idx_pokemon_types_type ON pokemon_types(type_id);
CREATE INDEX idx_pokemon_generation ON pokemon(generation_id);
CREATE INDEX idx_pokemon_forms_species ON pokemon_forms(species_id);

-- Flattened one-row-per-Pokemon view: the easy starting point.
CREATE VIEW pokedex AS
SELECT
    p.id,
    p.name,
    g.name  AS generation,
    g.region,
    g.id    AS generation_id,  -- for chronological ORDER BY (the text column sorts IX before V)
    t1.name AS type1,
    t2.name AS type2,
    p.hp, p.attack, p.defense,
    p.special_attack, p.special_defense, p.speed,
    p.total_stats,
    p.height_m, p.weight_kg,
    p.is_legendary, p.is_mythical,
    pre.name AS evolves_from,
    p.sprite_url,
    p.has_mega_evolution, p.mega_form_count, p.has_regional_form,
    p.evolution_stage, p.can_evolve,
    p.capture_rate, p.color, p.habitat, p.is_baby,
    p.genus, p.base_happiness, p.base_experience, p.evolves_from_id
FROM pokemon p
JOIN generations g   ON g.id = p.generation_id
LEFT JOIN pokemon_types pt1 ON pt1.pokemon_id = p.id AND pt1.slot = 1
LEFT JOIN types t1          ON t1.id = pt1.type_id
LEFT JOIN pokemon_types pt2 ON pt2.pokemon_id = p.id AND pt2.slot = 2
LEFT JOIN types t2          ON t2.id = pt2.type_id
LEFT JOIN pokemon pre       ON pre.id = p.evolves_from_id;
"""


def populate_database(con: sqlite3.Connection) -> None:
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

    # The main table stays one row per species. Alternate forms are linked
    # separately and never change the default-form type or achievement totals.
    source_pokemon = {row["id"]: row for row in read_csv("pokemon.csv")}
    default_forms = {
        row["species_id"]: row
        for row in source_pokemon.values()
        if row["is_default"] == "1"
    }

    # Base stats keyed by pokemon id: stat_id 1..6 -> hp..speed
    stats: dict[str, dict[str, int]] = {}
    for row in read_csv("pokemon_stats.csv"):
        stats.setdefault(row["pokemon_id"], {})[row["stat_id"]] = int(row["base_stat"])

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

    # Only the 18 canonical types: excludes 'unknown'/'shadow' (ids >= 10000)
    # and 'stellar' (id 19, a Tera battle gimmick with no species or matchup
    # data), keeping types consistent with the 18x18 type_matchups chart.
    main_types = [r for r in read_csv("types.csv") if int(r["id"]) <= 18]
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

    # egg_groups.csv identifiers diverge from the names players know
    # ('plant' vs 'Grass', 'humanshape' vs 'Human-Like'), so resolve them
    # through egg_group_prose.csv like abilities do with ability_names.csv.
    egg_group_names = {
        row["egg_group_id"]: row["name"]
        for row in read_csv("egg_group_prose.csv")
        if row["local_language_id"] == ENGLISH
    }
    con.executemany(
        "INSERT INTO egg_groups VALUES (?, ?)",
        [
            (int(r["id"]), egg_group_names.get(r["id"], r["identifier"]))
            for r in read_csv("egg_groups.csv")
        ],
    )

    species_rows = read_csv("pokemon_species.csv")
    evolutions = evolution_metadata(species_rows)
    for sp in species_rows:
        form = default_forms.get(sp["id"])
        if form is None:
            print(f"  warning: no default form for species {sp['identifier']}, skipping")
            continue
        st = stats.get(form["id"], {})
        stat_values = [st.get(str(i)) for i in range(1, 7)]
        display_name, genus = names.get(sp["id"], (sp["identifier"], None))
        con.execute(
            """INSERT INTO pokemon (
                id, name, generation_id, height_m, weight_kg, base_experience,
                hp, attack, defense, special_attack, special_defense, speed, total_stats,
                genus, color, habitat, capture_rate, base_happiness,
                is_legendary, is_mythical, is_baby, evolves_from_id, sprite_url,
                evolution_stage, can_evolve
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
                *evolutions[sp["id"]],
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

    form_names = {
        row["pokemon_form_id"]: row
        for row in read_csv("pokemon_form_names.csv")
        if row["local_language_id"] == ENGLISH
    }
    version_groups = {row["id"]: row for row in read_csv("version_groups.csv")}
    variety_types: dict[str, list[dict]] = {}
    for row in read_csv("pokemon_types.csv"):
        variety_types.setdefault(row["pokemon_id"], []).append(row)
    form_types: dict[str, list[dict]] = {}
    for row in read_csv("pokemon_form_types.csv"):
        form_types.setdefault(row["pokemon_form_id"], []).append(row)
    variety_abilities: dict[str, list[dict]] = {}
    for row in read_csv("pokemon_abilities.csv"):
        variety_abilities.setdefault(row["pokemon_id"], []).append(row)

    for form in read_csv("pokemon_forms.csv"):
        variety = source_pokemon[form["pokemon_id"]]
        species_id = variety["species_id"]
        if int(species_id) not in species_ids:
            continue
        species_name = names[species_id][0]
        english = form_names.get(form["id"], {})
        label = english.get("form_name") or form["form_identifier"].replace("-", " ").title() or None
        is_species_default = variety["is_default"] == "1" and form["is_default"] == "1"
        display_name = english.get("pokemon_name") or (
            species_name if is_species_default or not label else
            label if species_name in label else f"{species_name} ({label})"
        )
        version = version_groups[form["introduced_in_version_group_id"]]
        regional_region = REGIONAL_FORMS.get(form["form_identifier"])
        st = stats.get(variety["id"], {})
        stat_values = [st.get(str(i)) for i in range(1, 7)]
        con.execute(
            "INSERT INTO pokemon_forms VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                int(form["id"]), int(species_id), int(variety["id"]), form["identifier"], display_name, label,
                int(is_species_default), int(form["is_mega"]), int(regional_region is not None), regional_region,
                int(form["is_battle_only"]), int(version["generation_id"]), version["identifier"],
                int(variety["height"]) / 10 if variety["height"] else None,
                int(variety["weight"]) / 10 if variety["weight"] else None,
                num(variety["base_experience"]), *stat_values,
                sum(value for value in stat_values if value is not None) or None,
            ),
        )
        # Arceus and Silvally have form-specific type overrides. Unsupported
        # unknown/shadow/stellar types stay excluded, never replaced by Normal.
        con.executemany(
            "INSERT INTO pokemon_form_types VALUES (?, ?, ?)",
            [(int(form["id"]), int(row["type_id"]), int(row["slot"]))
             for row in form_types.get(form["id"], variety_types.get(variety["id"], []))
             if int(row["type_id"]) in type_ids],
        )
        con.executemany(
            "INSERT INTO pokemon_form_abilities VALUES (?, ?, ?, ?)",
            [(int(form["id"]), int(row["ability_id"]), int(row["is_hidden"]), int(row["slot"]))
             for row in variety_abilities.get(variety["id"], [])
             if int(row["ability_id"]) in ability_ids],
        )

    con.execute("""UPDATE pokemon SET
        mega_form_count = (SELECT COUNT(*) FROM pokemon_forms f WHERE f.species_id = pokemon.id AND f.is_mega = 1),
        has_mega_evolution = EXISTS (SELECT 1 FROM pokemon_forms f WHERE f.species_id = pokemon.id AND f.is_mega = 1),
        has_regional_form = EXISTS (SELECT 1 FROM pokemon_forms f WHERE f.species_id = pokemon.id AND f.is_regional = 1)
    """)


def build() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = DB_PATH.with_suffix(".sqlite.part")
    temporary.unlink(missing_ok=True)
    con = sqlite3.connect(temporary)
    try:
        populate_database(con)
        if con.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Built database failed integrity_check")
        if con.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Built database contains broken foreign keys")
        for table in ("pokemon", "pokemon_forms", "types", "abilities", "pokemon_types", "type_matchups"):
            count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"  {table}: {count} rows")
        con.commit()
        con.close()
        temporary.replace(DB_PATH)
    finally:
        con.close()
        temporary.unlink(missing_ok=True)

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
