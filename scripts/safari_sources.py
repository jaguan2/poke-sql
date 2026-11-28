"""Pinned, cached source artwork for the offline Safari asset builders."""
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EMERALD_REVISION = "9103e529c2fbdd7add4a1ff3350c6c1f92112c42"
FIRERED_REVISION = "ce6406d8c2eaf46d543c8a2606de0c3cb1951982"
PLATINUM_REVISION = "0660186c565124910371a3b0516a1b1df31b5b93"
CRYSTAL_REVISION = "9ce4c4e5068ffdf56e23ca3d8dc9178b2465d482"
CACHE = ROOT / "web/.cache/safari-source"
ARCHIVES = {
    "platinum": ("pokeplatinum", PLATINUM_REVISION, CACHE / "platinum" / PLATINUM_REVISION),
    "emerald": ("pokeemerald", EMERALD_REVISION, CACHE / EMERALD_REVISION),
    "firered": ("pokefirered", FIRERED_REVISION, CACHE / "firered" / FIRERED_REVISION),
    "crystal": ("pokecrystal", CRYSTAL_REVISION, CACHE / "crystal" / CRYSTAL_REVISION),
}


def source(path, archive="emerald"):
    repository, revision, cache = ARCHIVES[archive]
    target = cache / path
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://raw.githubusercontent.com/pret/{repository}/{revision}/{path}"
        with urllib.request.urlopen(url, timeout=30) as response:
            target.write_bytes(response.read())
    return target
